import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  generateMdfeComprovantePdf,
  type MdfeComprovantePayload,
} from '@/lib/generateMdfeComprovantePdf';
import type { MdfeEmissionRow } from '@/hooks/useMdfeEmission';

function digits(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '');
}

function uniqBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** Monta payload do comprovante a partir do MDF-e persistido + links CT-e. */
export async function buildMdfeComprovantePayload(
  emission: MdfeEmissionRow
): Promise<MdfeComprovantePayload> {
  const ps = (emission.payload_sent ?? {}) as Record<string, unknown>;
  const modal = (ps.modal_rodoviario ?? {}) as Record<string, unknown>;

  const ciotRaw = Array.isArray(modal.ciot) ? modal.ciot : [];
  const ciots = uniqBy(
    ciotRaw
      .map((c) => {
        const row = c as { ciot?: string; cnpj_responsavel?: string };
        const n = digits(row.ciot);
        if (n.length < 8) return null;
        return { number: n, cnpjResponsavel: digits(row.cnpj_responsavel) || null };
      })
      .filter(Boolean) as Array<{ number: string; cnpjResponsavel: string | null }>,
    (c) => `${c.number}|${c.cnpjResponsavel ?? ''}`
  );

  const vpoRaw = Array.isArray(modal.dispositivos_vale_pedagio)
    ? modal.dispositivos_vale_pedagio
    : [];
  const vpoFirst = vpoRaw[0] as
    | {
        numero_comprovante_compra?: string;
        cnpj_responsavel_pagamento?: string;
        cnpj_empresa_fornecedora?: string;
        valor_vale_pedagio?: number;
      }
    | undefined;
  const vpo = vpoFirst?.numero_comprovante_compra
    ? {
        idVpo: digits(vpoFirst.numero_comprovante_compra),
        cnpjPagador: digits(vpoFirst.cnpj_responsavel_pagamento) || null,
        cnpjFornecedora: digits(vpoFirst.cnpj_empresa_fornecedora) || null,
        valorReais:
          vpoFirst.valor_vale_pedagio != null ? Number(vpoFirst.valor_vale_pedagio) : null,
      }
    : null;

  const { data: links } = await supabase
    .from('mdfe_cte_link')
    .select('cte_emission_id')
    .eq('mdfe_id', emission.id);
  const cteIds = (links ?? []).map((l) => l.cte_emission_id).filter(Boolean);

  let ctes: MdfeComprovantePayload['ctes'] = [];
  if (cteIds.length > 0) {
    const { data: cteRows } = await supabase
      .from('cte_emissions')
      .select('id, numero, serie, chave_cte, order_id, quote_id, payload_sent')
      .in('id', cteIds)
      .order('numero', { ascending: true });

    const orderIds = [
      ...new Set((cteRows ?? []).map((c) => c.order_id).filter(Boolean)),
    ] as string[];
    const osMap = new Map<string, string>();
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, os_number')
        .in('id', orderIds);
      for (const o of orders ?? []) osMap.set(o.id, o.os_number);
    }

    ctes = (cteRows ?? []).map((c) => {
      const cps = (c.payload_sent ?? {}) as Record<string, unknown>;
      return {
        numero: c.numero,
        serie: c.serie,
        chave: digits(c.chave_cte),
        os_number: (c.order_id && osMap.get(c.order_id)) || null,
        municipio_destino: String(cps.municipio_fim ?? '') || null,
        uf_destino: String(cps.uf_fim ?? '') || null,
      };
    });
  }

  // Fallback: chaves do payload do MDF-e
  if (ctes.length === 0) {
    const munDesc = Array.isArray(ps.municipios_descarregamento)
      ? ps.municipios_descarregamento
      : [];
    for (const m of munDesc) {
      const mun = m as {
        nome?: string;
        conhecimentos_transporte?: Array<{ chave_cte?: string }>;
      };
      for (const ct of mun.conhecimentos_transporte ?? []) {
        const chave = digits(ct.chave_cte);
        if (!chave) continue;
        ctes.push({
          chave,
          municipio_destino: mun.nome ?? null,
        });
      }
    }
  }

  let driverName: string | null = null;
  let driverCpf: string | null = null;
  if (emission.driver_id) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('name, cpf')
      .eq('id', emission.driver_id)
      .maybeSingle();
    driverName = driver?.name ?? null;
    driverCpf = driver?.cpf ?? null;
  }

  let plate: string | null = null;
  let plate2: string | null = null;
  if (emission.vehicle_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('plate, plate_2')
      .eq('id', emission.vehicle_id)
      .maybeSingle();
    plate = vehicle?.plate ?? null;
    plate2 = vehicle?.plate_2 ?? null;
  }
  if (!plate) plate = String(modal.placa_veiculo ?? '') || null;

  const osNumbers = [...new Set(ctes.map((c) => c.os_number).filter(Boolean) as string[])].sort();

  return {
    mdfe_numero: emission.numero,
    mdfe_serie: emission.serie,
    chave_mdfe: digits(emission.chave_mdfe) || digits(String(ps.chave ?? '')),
    protocolo: emission.protocolo,
    status: emission.status,
    uf_inicio: emission.uf_inicio,
    uf_fim: emission.uf_fim,
    data_autorizacao: emission.data_autorizacao
      ? new Date(emission.data_autorizacao).toLocaleString('pt-BR')
      : null,
    vehicle_plate: plate,
    vehicle_plate_2: plate2,
    driver_name: driverName,
    driver_cpf: driverCpf,
    os_numbers: osNumbers,
    ciots,
    vpo,
    ctes,
    issued_at: new Date().toLocaleString('pt-BR'),
  };
}

export function useDownloadMdfeComprovante() {
  const [pending, setPending] = useState(false);

  const download = useCallback(async (emission: MdfeEmissionRow) => {
    setPending(true);
    try {
      const payload = await buildMdfeComprovantePayload(emission);
      const { blob, fileName } = await generateMdfeComprovantePdf(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Comprovante ${fileName} baixado`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar comprovante');
    } finally {
      setPending(false);
    }
  }, []);

  return { download, pending };
}
