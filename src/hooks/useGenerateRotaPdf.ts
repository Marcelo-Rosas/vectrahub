import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { OrderWithOccurrences } from '@/hooks/useOrders';
import type { StoredPricingBreakdown, TollPlaza } from '@/lib/freightCalculator';
import { generateRotaPdf, vehicleBrandModel, type RotaPdfStop } from '@/lib/generateRotaPdf';
import { resolveFreightPayerName } from '@/lib/canonical-doc-ref';
import { lookupVpoVehicleByPlate, tipoValeFromLookup, VPO_EMISSOR_INFO } from '@/lib/vpo-emissores';
import { buildRotaUfChain } from '@/lib/uf-percurso';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { isVpoReciboOk, parseVpoReciboViagem, type VpoReciboViagem } from '@/lib/vpo-recibo';

type VehicleRotaRow = {
  brand: string | null;
  model: string | null;
  driver: { antt: string | null } | { antt: string | null }[] | null;
  owner: { rntrc: string | null } | { rntrc: string | null }[] | null;
};

function embedOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const triggerBlobDownload = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.documentElement.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export function useGenerateRotaPdf() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const downloadRotaPdf = useCallback(
    async (order: OrderWithOccurrences, plazas: TollPlaza[]) => {
      setLoading(true);
      try {
        const quoteId = order.quote_id ?? order.quote?.id ?? null;
        let quoteCode = order.quote?.quote_code ?? null;
        let stops: RotaPdfStop[] = [];

        const plateDigits = String(order.vehicle_plate || '')
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase();
        const vehiclePromise = plateDigits
          ? supabase
              .from('vehicles')
              .select('brand, model, driver:drivers(antt), owner:owners(rntrc)')
              .ilike('plate', plateDigits)
              .maybeSingle()
          : Promise.resolve({ data: null as VehicleRotaRow | null, error: null as null });

        const [quoteRes, stopsRes, vehicleRes] = await Promise.all([
          quoteId
            ? quoteCode
              ? Promise.resolve({ data: { quote_code: quoteCode }, error: null })
              : supabase.from('quotes').select('quote_code').eq('id', quoteId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          quoteId
            ? supabase
                .from('quote_route_stops')
                .select('sequence, stop_type, name, city_uf, cep')
                .eq('quote_id', quoteId)
                .order('sequence', { ascending: true })
            : Promise.resolve({ data: [] as RotaPdfStop[], error: null }),
          vehiclePromise,
        ]);
        if (quoteRes.error) throw new Error(quoteRes.error.message);
        if (stopsRes.error) throw new Error(stopsRes.error.message);
        quoteCode = quoteCode ?? quoteRes.data?.quote_code ?? null;
        stops = (stopsRes.data ?? []).map((s) => ({
          sequence: s.sequence,
          stop_type: s.stop_type,
          name: s.name,
          city_uf: s.city_uf,
          cep: s.cep,
        }));
        const vehicleRow = vehicleRes.data;

        const vpoLookup = lookupVpoVehicleByPlate(order.vehicle_plate);
        const breakdown = (order.pricing_breakdown ?? order.quote?.pricing_breakdown) as
          | StoredPricingBreakdown
          | null
          | undefined;
        const vpoRec = breakdown?.meta?.vpo ?? null;
        let vpoRecibo: VpoReciboViagem | null = parseVpoReciboViagem(vpoRec?.recibo ?? null);
        if (!isVpoReciboOk(vpoRecibo) && (vpoRec?.idViagemAILog || vpoRec?.idVpo)) {
          try {
            const recRes = await invokeEdgeFunction<{
              success?: boolean;
              recibo?: unknown;
              error?: string;
            }>('get-vpo-recibo', {
              body: { order_id: order.id },
              requireAuth: true,
            });
            if (recRes?.success) {
              vpoRecibo = parseVpoReciboViagem(recRes.recibo) ?? vpoRecibo;
            }
          } catch (reciboErr) {
            console.warn('[rota-pdf] get-vpo-recibo failed', reciboErr);
          }
        }
        const freightType = order.quote?.freight_type ?? null;
        const payerName = resolveFreightPayerName(
          freightType,
          order.client_name ?? order.quote?.client_name,
          order.shipper_name ?? order.quote?.shipper_name
        );

        const ufChain = buildRotaUfChain({
          origin: order.origin ?? order.quote?.origin,
          destination: order.destination ?? order.quote?.destination,
          stopCityUfs: stops.map((s) => s.city_uf),
          plazaUfs: plazas.map((p) => p.uf),
        });

        const totalValor = plazas.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);
        const totalTag = plazas.reduce((sum, p) => sum + (Number(p.valorTag) || 0), 0);
        const issuedBy =
          (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
          user?.email ||
          null;

        const { blob, fileName } = await generateRotaPdf({
          os_number: order.os_number,
          quote_code: quoteCode,
          freight_type: freightType,
          payer_name: payerName || null,
          issued_at: new Date().toISOString(),
          issued_by_name: issuedBy,
          origin: order.origin,
          destination: order.destination,
          km_distance: order.km_distance ?? order.quote?.km_distance ?? null,
          driver_name:
            order.driver_name ?? order.driver?.name ?? vpoLookup?.nomeProprietario ?? null,
          vehicle_plate: order.vehicle_plate,
          vehicle_label:
            [vehicleRow?.brand, vehicleRow?.model].filter(Boolean).join(' ').trim() ||
            vehicleBrandModel(vpoLookup?.descricao) ||
            vehicleBrandModel(order.vehicle_type?.name) ||
            null,
          antt:
            (order as { driver_antt?: string | null }).driver_antt ||
            embedOne(vehicleRow?.driver)?.antt ||
            embedOne(vehicleRow?.owner)?.rntrc ||
            null,
          axes_count: vpoLookup?.quantidadeEixos ?? order.vehicle_type?.axes_count ?? null,
          vpo_emissor: vpoLookup
            ? VPO_EMISSOR_INFO[vpoLookup.emissor].nome
            : (vpoRec?.emissor ?? null),
          vpo_tag: vpoLookup?.tag ?? vpoRec?.tag ?? null,
          vpo_tipo_vale: vpoLookup
            ? tipoValeFromLookup(vpoLookup) === '01'
              ? '01 — TAG'
              : '04'
            : null,
          vpo_tipo_viagem: vpoRecibo?.tipo || vpoRec?.tipoViagem || 'ESTENDIDA',
          vpo_id_antt: vpoRec?.idANTT ?? vpoRec?.idVpo ?? null,
          vpo_codigo_viagem: vpoRec?.codigoViagem ?? null,
          vpo_recibo: vpoRecibo,
          plazas,
          stops,
          uf_chain: ufChain,
          toll_total:
            plazas.length > 0
              ? totalValor
              : order.toll_value != null
                ? Number(order.toll_value)
                : null,
          toll_tag_total: plazas.length > 0 ? totalTag : null,
        });

        triggerBlobDownload(blob, fileName);
        toast.success('PDF da rota gerado');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível gerar o PDF da rota.';
        toast.error('Falha ao gerar PDF da rota', { description: message });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return { downloadRotaPdf, loading };
}
