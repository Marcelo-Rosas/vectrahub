import { generateQuotePdf } from '@/lib/generateQuotePdf';
import { fairPdfDisclaimer } from '@/lib/fair-hub-clone';
import type { FairSavedQuote } from '@/lib/fair-quote-store';
import type { FairTenant } from '@/lib/fair-tenant';
import { formatFairCep } from '@/lib/fair-client';

function playfitPdfNotes(quote: FairSavedQuote): string {
  const b = quote.playfitBreakdown;
  if (!b) return fairPdfDisclaimer();
  const branch = b.branchId ? ` · Filial ${b.branchId}` : '';
  return [
    fairPdfDisclaimer(),
    `PlayFit · ${b.lineCode ?? b.sku} mm · ${b.m2} m² · ${b.palletQty} pallets · ${b.platesPerPallet} placas/pallet · ${b.weightKgPerPlate} kg/placa${branch}`,
  ].join('\n');
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
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
}

export async function downloadFairQuotePdf(
  quote: FairSavedQuote,
  tenant: FairTenant
): Promise<void> {
  const { blob, fileName } = await generateQuotePdf({
    quote: {
      id: quote.id,
      quote_code: quote.code,
      client_name: quote.client.name,
      origin: quote.origin,
      destination: quote.destination,
      origin_cep: tenant.originCep,
      destination_cep: quote.client.deliveryDifferent
        ? quote.client.deliveryZip
        : quote.client.zipCode,
      value: quote.totalExibido,
      cargo_type: 'Equipamentos fitness',
      cargo_value: quote.cargoValue,
      weight: quote.weightKg,
      volume: quote.volumeM3,
      km_distance: quote.km,
      estimated_loading_date: null,
      notes: playfitPdfNotes(quote),
      created_at: quote.createdAt,
      updated_at: quote.createdAt,
      freight_modality: quote.freightModality ?? 'lotacao',
      freight_type:
        quote.freightTypeLabel ??
        (quote.freightModality === 'fracionado' ? 'Fracionado' : 'Dedicado'),
      suggested_vehicle_label: quote.suggestedVehicleLabel ?? null,
      shipper_name_fallback: tenant.name,
      shipper: {
        name: tenant.name,
        cnpj: '15.563.385/0001-72',
        city: tenant.originCity,
        state: tenant.originUf,
        address: 'Rodovia Jorge Lacerda',
        address_number: '725',
        zip_code: formatFairCep(tenant.originCep),
      },
      client: {
        name: quote.client.name,
        cnpj: quote.client.kind === 'cnpj' ? quote.client.document : null,
        cpf: quote.client.kind === 'cpf' ? quote.client.document : null,
        email: quote.client.email || null,
        city: quote.client.city || null,
        state: quote.client.state || null,
        address: quote.client.address || null,
        zip_code: quote.client.zipCode || null,
      },
      event_flag: quote.eventFlag,
      pedagio_estimado: quote.pedagioEstimado,
      fair_freight_total: quote.hubTotalCliente,
      fair_disclaimer: true,
    },
    mode: 'simplified',
  });
  triggerBlobDownload(blob, fileName);
}
