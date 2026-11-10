/**
 * Monta o HubCiotLoad de uma OS (contratado, veículo, destinatário, contratante, rota, frete).
 * Compartilhado por generate-ciot (emitir) e manage-ciot (precheck). Extraído do generate-ciot.
 */
import { digits, formatPlateForCiot } from './ailog-ciot-client.ts';
import { pickContratadoFromDriverCadastro, type HubCiotLoad } from './ailog-ciot-hub.ts';

function envOr(key: string, fallback = ''): string {
  return Deno.env.get(key) || fallback;
}

export type HubCiotLoaded = {
  load: HubCiotLoad;
  osId: string;
  osQuoteId: string | null;
  contratadoDoc: string;
  contratanteDoc: string;
};

export async function loadHubCiotForOrder(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orderId: string
): Promise<HubCiotLoaded | { error: string; status: number }> {
  const { data: os, error: osErr } = await supabase
    .from('orders')
    .select(
      `id, os_number, origin, destination, origin_cep, destination_cep, value, vehicle_plate,
       client_name, client_id, quote_id, weight, km_distance, carreteiro_real, pedagio_real,
       pickup_date, eta, driver_id, driver_name, driver_antt,
       quote:quotes(id, origin, destination, origin_cep, destination_cep, origin_ibge, destination_ibge,
         origin_uf, destination_uf, km_distance, weight, client_id, toll_value, estimated_loading_date)`
    )
    .eq('id', orderId)
    .single();

  if (osErr || !os) {
    return { error: `Service order not found: ${osErr?.message}`, status: 404 };
  }

  const quote = (os.quote && !Array.isArray(os.quote) ? os.quote : os.quote?.[0]) as Record<
    string,
    unknown
  > | null;

  const plateRaw = String(os.vehicle_plate || '');
  const plate = formatPlateForCiot(plateRaw);
  const vehSelect = `id, plate, plate_2, driver_id, owner_id, cpf_cnpj_proprietario, nome_proprietario, rntrc_proprietario,
         owner:owners(id, cpf_cnpj, name, rntrc, bank_code, bank_agency, bank_account, pix_key, tipo_proprietario),
         vehicle_type:vehicle_types(axes_count)`;
  let veh: Record<string, unknown> | null = null;
  if (plate) {
    const { data: vehRows } = await supabase.from('vehicles').select(vehSelect).eq('active', true);
    veh =
      ((vehRows as Record<string, unknown>[] | null) || []).find(
        (row) => formatPlateForCiot(String(row.plate || '')) === plate
      ) ?? null;
  }

  const vehType = (
    veh?.vehicle_type && !Array.isArray(veh.vehicle_type)
      ? veh.vehicle_type
      : (veh?.vehicle_type as unknown[] | undefined)?.[0]
  ) as { axes_count?: number | null } | undefined;

  let driver: Record<string, unknown> | null = null;
  const driverId = String(os.driver_id || veh?.driver_id || '');
  if (driverId) {
    const { data: drv } = await supabase
      .from('drivers')
      .select('id, name, cpf, antt, contract_type, rntrc_registry_type')
      .eq('id', driverId)
      .maybeSingle();
    driver = drv as Record<string, unknown> | null;
  }

  let owner = (
    veh?.owner && !Array.isArray(veh.owner) ? veh.owner : (veh?.owner as unknown[])?.[0]
  ) as Record<string, unknown> | null | undefined;
  const driverCpf = digits(driver?.cpf);
  if ((!owner || !digits(owner.rntrc)) && driverCpf.length === 11) {
    const { data: ownerByCpf } = await supabase
      .from('owners')
      .select(
        'id, cpf_cnpj, name, rntrc, bank_code, bank_agency, bank_account, pix_key, tipo_proprietario'
      )
      .eq('cpf_cnpj', driverCpf)
      .maybeSingle();
    if (ownerByCpf) owner = ownerByCpf as Record<string, unknown>;
  }

  const clientId = String(os.client_id || quote?.client_id || '');
  let client: Record<string, unknown> | null = null;
  if (clientId) {
    const { data: cl } = await supabase
      .from('clients')
      .select(
        'cnpj, cpf, name, address, address_number, address_neighborhood, city, state, zip_code, ibge_code'
      )
      .eq('id', clientId)
      .maybeSingle();
    client = cl as Record<string, unknown> | null;
  }

  const contratado = pickContratadoFromDriverCadastro({
    rntrcRegistryType: driver?.rntrc_registry_type ? String(driver.rntrc_registry_type) : null,
    driverCpf: driver?.cpf ? String(driver.cpf) : null,
    driverAntt: driver?.antt ? String(driver.antt) : null,
    driverName: driver?.name ? String(driver.name) : null,
    orderDriverAntt: os.driver_antt ? String(os.driver_antt) : null,
    orderDriverName: os.driver_name ? String(os.driver_name) : null,
    ownerCpfCnpj: owner?.cpf_cnpj ? String(owner.cpf_cnpj) : null,
    ownerRntrc: owner?.rntrc ? String(owner.rntrc) : null,
    ownerName: owner?.name ? String(owner.name) : null,
    vehicleCpfCnpj: veh?.cpf_cnpj_proprietario ? String(veh.cpf_cnpj_proprietario) : null,
    vehicleRntrc: veh?.rntrc_proprietario ? String(veh.rntrc_proprietario) : null,
    vehicleNome: veh?.nome_proprietario ? String(veh.nome_proprietario) : null,
  });
  const contratadoDoc = contratado.doc;
  const contratadoNome = contratado.nome;
  const contratadoRntrc = contratado.rntrc;

  const destDoc = digits(client?.cnpj) || digits(client?.cpf);
  const destNome = String(client?.name || os.client_name || '');

  const contratanteDoc = envOr('VECTRA_CNPJ') || envOr('CIOT_COMPANY_CNPJ');
  const { data: cs } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();

  const tipoViagem: 1 | 3 = String(driver?.contract_type || '') === 'agregado' ? 3 : 1;

  const load: HubCiotLoad = {
    osNumber: String(os.os_number || os.id),
    originLabel: String(os.origin || quote?.origin || ''),
    destLabel: String(os.destination || quote?.destination || ''),
    originCep: String(os.origin_cep || quote?.origin_cep || ''),
    destCep: String(os.destination_cep || quote?.destination_cep || client?.zip_code || ''),
    originIbge: (quote?.origin_ibge as number | null) ?? null,
    destIbge:
      (quote?.destination_ibge as number | null) ?? (client?.ibge_code as number | null) ?? null,
    km: Number(os.km_distance || quote?.km_distance || 0),
    valorFrete: Number(os.carreteiro_real ?? os.value ?? 0),
    valorPedagio: Number(os.pedagio_real ?? quote?.toll_value ?? 0),
    pesoKg: Number(os.weight || quote?.weight || 0),
    pickupDate: (os.pickup_date || quote?.estimated_loading_date) as string | null,
    eta: os.eta as string | null,
    plate,
    plate2: veh?.plate_2 ? String(veh.plate_2) : null,
    tipoViagem,
    contratadoDoc,
    contratadoNome,
    contratadoRntrc,
    destDoc,
    destNome,
    destLogradouro: client?.address ? String(client.address) : null,
    destNumero: client?.address_number ? String(client.address_number) : null,
    destBairro: client?.address_neighborhood ? String(client.address_neighborhood) : null,
    destCidade: client?.city ? String(client.city) : null,
    destUf: client?.state
      ? String(client.state)
      : quote?.destination_uf
        ? String(quote.destination_uf)
        : null,
    destCepOverride: client?.zip_code ? String(client.zip_code) : null,
    destIbgeOverride: (client?.ibge_code as number | null) ?? null,
    contratanteDoc,
    contratanteNome: envOr('VECTRA_NOME') || String(cs?.legal_name || cs?.trade_name || ''),
    contratanteRntrc: envOr('VECTRA_RNTRC'),
    contratanteLogradouro: envOr('VECTRA_LOGRADOURO') || String(cs?.address_street || ''),
    contratanteNumero: envOr('VECTRA_NUMERO') || String(cs?.address_number || 'S/N'),
    contratanteBairro: envOr('VECTRA_BAIRRO') || String(cs?.address_neighborhood || ''),
    contratanteCidade: envOr('VECTRA_MUNICIPIO') || String(cs?.address_city || ''),
    contratanteUf: envOr('VECTRA_UF') || String(cs?.address_state || ''),
    contratanteCep: envOr('VECTRA_CEP') || String(cs?.address_zip || ''),
    contratanteIbge: Number(envOr('VECTRA_IBGE_MUN')) || null,
    contratanteComplemento: envOr('VECTRA_COMPLEMENTO') || String(cs?.address_complement || ''),
    bancoCodigo: owner?.bank_code ? String(owner.bank_code) : null,
    bancoAgencia: owner?.bank_agency ? String(owner.bank_agency) : null,
    bancoConta: owner?.bank_account ? String(owner.bank_account) : null,
    bancoCpfTitular: contratadoDoc.length === 11 ? contratadoDoc : null,
    pixKey: owner?.pix_key ? String(owner.pix_key) : null,
    tipoProprietario: owner?.tipo_proprietario != null ? Number(owner.tipo_proprietario) : null,
    eixos: Number(vehType?.axes_count) || null,
  };

  return {
    load,
    osId: String(os.id),
    osQuoteId: os.quote_id ? String(os.quote_id) : null,
    contratadoDoc,
    contratanteDoc,
  };
}
