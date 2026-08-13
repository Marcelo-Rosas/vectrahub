import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  loadShipperById,
  resolveFirstAdditionalShipperEntry,
  shipperRecordToPartyData,
} from '@/lib/collection-order-parties';
import {
  anttEvidenceToCollectionOrderSnapshot,
  resolveAnttEvidenceForOrder,
} from '@/lib/risk-antt-evidence';
import { generateCollectionOrderPdf } from '@/lib/generateCollectionOrderPdf';
import { resolveFreightPayerName } from '@/lib/canonical-doc-ref';
import type {
  CollectionOrder,
  CollectionOrderCargoData,
  CollectionOrderDriverData,
  CollectionOrderPartyData,
  CollectionOrderVehicleData,
} from '@/types/collectionOrder';

const COLLECTION_ORDERS_QK = 'collection_orders';

export function useCollectionOrders(orderId: string | undefined) {
  return useQuery({
    queryKey: [COLLECTION_ORDERS_QK, 'order', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<CollectionOrder[]> => {
      const { data, error } = await supabase
        .from('collection_orders')
        .select('*')
        .eq('order_id', orderId!)
        .order('issued_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CollectionOrder[];
    },
    staleTime: 30_000,
  });
}

export interface CancelCollectionOrderInput {
  collectionOrderId: string;
  reason?: string | null;
}

export function useCancelCollectionOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionOrderId, reason }: CancelCollectionOrderInput) => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id ?? null;

      const { data, error } = await supabase
        .from('collection_orders')
        .update({
          status: 'cancelada',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: reason ?? null,
        })
        .eq('id', collectionOrderId)
        .eq('status', 'emitida')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_ORDERS_QK, 'order', orderId] });
    },
  });
}

export function downloadCollectionOrderPdf(storagePath: string | null | undefined) {
  if (!storagePath) {
    return Promise.reject(new Error('PDF nao disponivel para esta OC'));
  }
  return supabase.storage
    .from('collection-orders')
    .createSignedUrl(storagePath, 60 * 5)
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('URL assinada nao retornada');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    });
}

// ── Create ──────────────────────────────────────────────────────────────────────

export interface CreateCollectionOrderInput {
  orderId: string;
  /** Texto livre para "Informações Adicionais" (auto da cotação + edits) */
  additionalInfo?: string | null;
  /** Override opcional dos campos do remetente 1 (Nº/Bairro/Comp da coleta) */
  senderOverride?: Partial<CollectionOrderPartyData>;
  /** Override opcional do remetente 2 (coleta adicional da cotação) */
  sender2Override?: Partial<CollectionOrderPartyData>;
}

export function useCreateCollectionOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId: oid,
      additionalInfo,
      senderOverride,
      sender2Override,
    }: CreateCollectionOrderInput) => {
      // 1. Carregar dados base
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select(
          `id, os_number, notes, weight, volume, cargo_value, cargo_type, freight_type,
           shipper_id, client_id, driver_id, vehicle_plate, vehicle_brand, vehicle_model, vehicle_type_name,
           driver_name, driver_phone, driver_cnh, driver_antt,
           eta, pickup_date, origin, destination, origin_cep, destination_cep,
           quote_id, additional_shippers,
           shipper:shippers(id, name, cnpj, cpf, phone, email, address, address_number, address_complement, address_neighborhood, zip_code, city, state),
           client:clients(id, name, cnpj, cpf, phone, email, address, address_number, address_complement, address_neighborhood, zip_code, city, state),
           driver:drivers(id, name, cpf, cnh, antt, phone)`
        )
        .eq('id', oid)
        .single();

      if (orderErr) throw orderErr;
      if (!order) throw new Error('OS nao encontrada');

      // 2. Buscar carreta + dados do proprietario via vehicles → owners
      // Prioridade: veiculo pela placa da OS (vehicle_plate); fallback: 1o veiculo do motorista.
      let trailerPlate: string | null = null;
      let ownerInfo: {
        cpf_cnpj: string | null;
        city: string | null;
        state: string | null;
        registered_at: string | null;
      } | null = null;
      const vehicleSelect =
        'plate, plate_2, owner_id, owner:owners(cpf_cnpj, city, state, created_at)';
      let veh: Record<string, unknown> | null = null;
      const osPlate = order.vehicle_plate?.trim().toUpperCase().replace(/[-\s]/g, '');
      if (osPlate) {
        const { data } = await supabase
          .from('vehicles')
          .select(vehicleSelect)
          .ilike('plate', osPlate)
          .limit(1)
          .maybeSingle();
        veh = data;
      }
      if (!veh && order.driver_id) {
        const { data } = await supabase
          .from('vehicles')
          .select(vehicleSelect)
          .eq('driver_id', order.driver_id)
          .limit(1)
          .maybeSingle();
        veh = data;
      }
      trailerPlate = (veh?.plate_2 as string | null) ?? null;
      const ow = (veh as unknown as { owner?: Record<string, unknown> | null })?.owner ?? null;
      if (ow) {
        ownerInfo = {
          cpf_cnpj: (ow.cpf_cnpj as string) ?? null,
          city: (ow.city as string) ?? null,
          state: (ow.state as string) ?? null,
          registered_at: (ow.created_at as string) ?? null,
        };
      }

      // 2b. ANTT/RNTRC — mesma fonte e matching do RiskWorkflowWizard (risk_evidence)
      let anttSnapshot: import('@/types/collectionOrder').CollectionOrderAnttData | null = null;
      try {
        const driver = (order as unknown as { driver: Record<string, unknown> | null }).driver;
        const driverCpf = (driver?.cpf as string) ?? null;
        const anttEvidence = await resolveAnttEvidenceForOrder(supabase, {
          orderId: oid,
          driverCpf,
          vehiclePlate: order.vehicle_plate,
        });
        if (anttEvidence) {
          anttSnapshot = anttEvidenceToCollectionOrderSnapshot(anttEvidence, {
            cpf_cnpj: ownerInfo?.cpf_cnpj,
            city: ownerInfo?.city,
            state: ownerInfo?.state,
          });
        }
      } catch {
        // se a busca falhar a OC ainda emite — antt_data fica null
      }

      // 3. Próximo número
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const { data: seqData, error: seqErr } = await supabase.rpc('next_collection_order_seq', {
        p_year: year,
        p_month: month,
      });
      if (seqErr) throw seqErr;
      const seq = seqData as number;
      const ocNumber = `OC-${year}-${String(month).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;

      // 4. Snapshots
      const shipper = (order as unknown as { shipper: Record<string, unknown> | null }).shipper;
      const client = (order as unknown as { client: Record<string, unknown> | null }).client;
      const driver = (order as unknown as { driver: Record<string, unknown> | null }).driver;

      // Numero, complemento e bairro NAO vem do cadastro do shipper — sao
      // dados da operacao de coleta especifica e vem do senderOverride
      // preenchido pelo operador no Wizard da OC.
      const sender =
        shipperRecordToPartyData(shipper, {
          fallbackZip: order.origin_cep,
          override: senderOverride,
        }) ??
        ({
          name: '',
          cnpj: null,
          cpf: null,
          phone: null,
          email: null,
          address: null,
          address_number: null,
          address_complement: null,
          address_neighborhood: null,
          zip_code: order.origin_cep ?? null,
          city: null,
          state: null,
          ...(senderOverride ?? {}),
        } satisfies CollectionOrderPartyData);

      const orderRow = order as {
        quote_id?: string | null;
        additional_shippers?: unknown;
      };
      const additionalEntry = await resolveFirstAdditionalShipperEntry(supabase, {
        quoteId: orderRow.quote_id ?? null,
        orderAdditionalShippers: orderRow.additional_shippers,
      });

      let sender2: CollectionOrderPartyData | null = null;
      if (additionalEntry) {
        const additionalShipper = additionalEntry.shipper_id
          ? await loadShipperById(supabase, additionalEntry.shipper_id)
          : null;
        sender2 = shipperRecordToPartyData(additionalShipper, {
          quoteEntry: additionalEntry,
          override: sender2Override,
        });
      }

      const recipient: CollectionOrderPartyData = {
        name: (client?.name as string) ?? '',
        cnpj: (client?.cnpj as string) ?? null,
        cpf: (client?.cpf as string) ?? null,
        phone: (client?.phone as string) ?? null,
        email: (client?.email as string) ?? null,
        address: (client?.address as string) ?? null,
        address_number: (client?.address_number as string) ?? null,
        address_complement: (client?.address_complement as string) ?? null,
        address_neighborhood: (client?.address_neighborhood as string) ?? null,
        zip_code: (client?.zip_code as string) ?? order.destination_cep ?? null,
        city: (client?.city as string) ?? null,
        state: (client?.state as string) ?? null,
      };

      const driverData: CollectionOrderDriverData = {
        name: (driver?.name as string) ?? order.driver_name ?? '',
        cpf: (driver?.cpf as string) ?? null,
        cnh: (driver?.cnh as string) ?? order.driver_cnh ?? null,
        antt: (driver?.antt as string) ?? order.driver_antt ?? null,
        phone: (driver?.phone as string) ?? order.driver_phone ?? null,
      };

      const vehicleData: CollectionOrderVehicleData = {
        plate: order.vehicle_plate ?? null,
        trailer_plate: trailerPlate,
        vehicle_type: order.vehicle_type_name ?? null,
        brand: order.vehicle_brand ?? null,
        model: order.vehicle_model ?? null,
      };

      const cargoData: CollectionOrderCargoData = {
        weight_kg: order.weight != null ? Number(order.weight) : null,
        volume_m3: order.volume != null ? Number(order.volume) : null,
        cargo_value: order.cargo_value != null ? Number(order.cargo_value) : null,
        cargo_type: order.cargo_type ?? null,
      };

      // 5. Datas (pickup_date e delivery_date)
      // pickup_date vem direto da OS (preenchido pelo operador no formulário).
      // ETA é a chegada no destino → delivery_date.
      const pickupDate: string | null =
        ((order as unknown as Record<string, unknown>).pickup_date as string | null) ?? null;
      const deliveryDate: string | null = order.eta
        ? new Date(order.eta).toISOString().slice(0, 10)
        : null;

      // 6. Identidade do emissor
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      let issuedByName: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', userId)
          .maybeSingle();
        issuedByName = profile?.full_name ?? profile?.email ?? null;
      }

      // 7. Gerar PDF
      const issuedAtIso = new Date().toISOString();
      // Regra canônica: razão social do pagador do frete (CIF → embarcador; FOB → cliente).
      const payerName = resolveFreightPayerName(
        (order as { freight_type?: string | null }).freight_type,
        recipient.name,
        sender.name
      );

      const { blob } = await generateCollectionOrderPdf({
        oc_number: ocNumber,
        payer_name: payerName,
        issued_at: issuedAtIso,
        issued_by_name: issuedByName,
        sender,
        sender_2: sender2,
        recipient,
        driver: driverData,
        vehicle: vehicleData,
        cargo: cargoData,
        antt: anttSnapshot,
        pickup_date: pickupDate,
        delivery_date: deliveryDate,
        observation: order.notes ?? null,
        additional_info: additionalInfo ?? null,
      });

      // 8. Upload no bucket
      const storagePath = `${oid}/${ocNumber}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('collection-orders')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      // 9. INSERT
      const { data: inserted, error: insertErr } = await supabase
        .from('collection_orders')
        .insert({
          oc_number: ocNumber,
          oc_year: year,
          oc_month: month,
          oc_seq: seq,
          order_id: oid,
          status: 'emitida',
          sender_data: sender as unknown as Record<string, unknown>,
          sender_2_data: sender2 as unknown as Record<string, unknown> | null,
          recipient_data: recipient as unknown as Record<string, unknown>,
          driver_data: driverData as unknown as Record<string, unknown>,
          vehicle_data: vehicleData as unknown as Record<string, unknown>,
          cargo_data: cargoData as unknown as Record<string, unknown>,
          antt_data: anttSnapshot as unknown as Record<string, unknown> | null,
          pickup_date: pickupDate,
          delivery_date: deliveryDate,
          additional_info: additionalInfo ?? null,
          pdf_storage_path: storagePath,
          issued_at: issuedAtIso,
          issued_by: userId,
        })
        .select()
        .single();

      if (insertErr) {
        // Rollback do storage se INSERT falhar
        await supabase.storage.from('collection-orders').remove([storagePath]);
        throw insertErr;
      }

      // Nº/Bairro/Complemento sao da OPERACAO, nao do cadastro — nao
      // persistir no shipper (mesmo embarcador pode coletar em enderecos
      // diferentes). Ficam apenas no snapshot da OC.

      return { collectionOrder: inserted, blob };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_ORDERS_QK, 'order', orderId] });
    },
  });
}
