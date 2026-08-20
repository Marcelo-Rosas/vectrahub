import { lookupIbgeByCep, type IbgeLookupResult } from './ibge-lookup.ts';
import {
  ailogCidade,
  digits,
  formatCepBr,
  formatCiotDate,
  formatPlateForCiot,
  parseCityUfLabel,
  type AilogCiotEmitInput,
  type AilogEndereco,
} from './ailog-ciot-client.ts';

function latLngZero() {
  return { latitude: 0, longitude: 0 };
}

function enderecoFromLookup(
  lookup: IbgeLookupResult | null | undefined,
  cidade: { cidade: string; uf: string; ibge?: number | null },
  cep: string,
  extra?: Partial<AilogEndereco>
): AilogEndereco {
  const uf = (lookup?.uf || cidade.uf || extra?.cidade?.uf || '').toUpperCase().slice(0, 2);
  const nome = lookup?.municipio || cidade.cidade || extra?.cidade?.cidade || '';
  const ibge = lookup?.ibge_code || cidade.ibge || extra?.cidade?.codigoIbge || 0;
  return {
    cidade: ailogCidade({ cidade: nome, uf, ibge }),
    logradouro: extra?.logradouro || lookup?.logradouro || 'S/N',
    numero: extra?.numero || 'S/N',
    complemento: extra?.complemento || '',
    cep: formatCepBr(cep),
    bairro: extra?.bairro || lookup?.bairro || 'Centro',
    latLng: extra?.latLng || latLngZero(),
  };
}

export type HubCiotLoad = {
  osNumber: string;
  originLabel: string;
  destLabel: string;
  originCep: string;
  destCep: string;
  originIbge?: number | null;
  destIbge?: number | null;
  km: number;
  valorFrete: number;
  valorPedagio: number;
  pesoKg: number;
  pickupDate?: string | null;
  eta?: string | null;
  plate: string;
  plate2?: string | null;
  tipoViagem: 1 | 3;
  contratadoDoc: string;
  contratadoNome: string;
  contratadoRntrc: string;
  destDoc: string;
  destNome: string;
  destLogradouro?: string | null;
  destNumero?: string | null;
  destBairro?: string | null;
  destCidade?: string | null;
  destUf?: string | null;
  destCepOverride?: string | null;
  destIbgeOverride?: number | null;
  contratanteDoc: string;
  contratanteNome: string;
  contratanteRntrc: string;
  contratanteLogradouro: string;
  contratanteNumero: string;
  contratanteBairro: string;
  contratanteCidade: string;
  contratanteUf: string;
  contratanteCep: string;
  contratanteIbge?: number | null;
  contratanteComplemento?: string;
  bancoCodigo?: string | null;
  bancoAgencia?: string | null;
  bancoConta?: string | null;
  bancoCpfTitular?: string | null;
};

export type HubCiotBuildResult =
  | { ok: true; input: AilogCiotEmitInput }
  | { ok: false; error: string };

/** Fonte: cadastro Motoristas (CPF, ANTT/RNTRC, TAC/ETC). TAC = contratado é o motorista. */
export function pickContratadoFromDriverCadastro(opts: {
  rntrcRegistryType?: string | null;
  driverCpf?: string | null;
  driverAntt?: string | null;
  driverName?: string | null;
  orderDriverAntt?: string | null;
  orderDriverName?: string | null;
  ownerCpfCnpj?: string | null;
  ownerRntrc?: string | null;
  ownerName?: string | null;
  vehicleCpfCnpj?: string | null;
  vehicleRntrc?: string | null;
  vehicleNome?: string | null;
}): { doc: string; rntrc: string; nome: string } {
  const registry = String(opts.rntrcRegistryType || '').toUpperCase();
  const driverDoc = digits(opts.driverCpf);
  const driverRntrc = digits(opts.driverAntt) || digits(opts.orderDriverAntt);
  const driverNome = String(opts.driverName || opts.orderDriverName || '').trim();
  const ownerDoc = digits(opts.ownerCpfCnpj) || digits(opts.vehicleCpfCnpj);
  const ownerRntrc = digits(opts.ownerRntrc) || digits(opts.vehicleRntrc);
  const ownerNome = String(opts.ownerName || opts.vehicleNome || '').trim();

  const tac =
    registry === 'TAC' ||
    (driverDoc.length === 11 && driverRntrc.length >= 8 && registry !== 'ETC');

  if (tac) {
    return {
      doc: driverDoc || ownerDoc,
      rntrc: driverRntrc || ownerRntrc,
      nome: driverNome || ownerNome,
    };
  }

  return {
    doc: ownerDoc || driverDoc,
    rntrc: ownerRntrc || driverRntrc,
    nome: ownerNome || driverNome,
  };
}

export async function resolveLookups(load: HubCiotLoad): Promise<{
  origin: IbgeLookupResult | null;
  dest: IbgeLookupResult | null;
  contratante: IbgeLookupResult | null;
}> {
  const [origin, dest, contratante] = await Promise.all([
    lookupIbgeByCep(load.originCep),
    lookupIbgeByCep(load.destCep || load.destCepOverride || ''),
    lookupIbgeByCep(load.contratanteCep),
  ]);
  return { origin, dest, contratante };
}

export function buildHubAilogEmit(
  load: HubCiotLoad,
  lookups: {
    origin: IbgeLookupResult | null;
    dest: IbgeLookupResult | null;
    contratante: IbgeLookupResult | null;
  }
): HubCiotBuildResult {
  const plate = formatPlateForCiot(load.plate);
  if (plate.length < 7) return { ok: false, error: 'Placa do veículo inválida para CIOT' };

  const contratadoDoc = digits(load.contratadoDoc);
  if (contratadoDoc.length !== 11 && contratadoDoc.length !== 14) {
    return {
      ok: false,
      error: 'Contratado sem CPF/CNPJ (owner/driver). CIOT AILOG precisa do documento do TAC.',
    };
  }
  const contratadoRntrc = digits(load.contratadoRntrc);
  if (contratadoRntrc.length < 8) {
    return {
      ok: false,
      error: 'Contratado sem RNTRC (owner.rntrc / vehicle.rntrc_proprietario / driver.antt).',
    };
  }

  const contratanteDoc = digits(load.contratanteDoc);
  if (contratanteDoc.length !== 14) {
    return {
      ok: false,
      error: 'VECTRA_CNPJ / CIOT_COMPANY_CNPJ ausente ou inválido (contratante).',
    };
  }

  const originParsed = parseCityUfLabel(load.originLabel);
  const destParsed = parseCityUfLabel(load.destLabel);
  const destCep = load.destCepOverride || load.destCep;
  if (digits(load.originCep).length !== 8) {
    return {
      ok: false,
      error: 'CEP origem ausente na OS/cotação — necessário para emitir CIOT AILOG.',
    };
  }
  if (digits(destCep).length !== 8) {
    return {
      ok: false,
      error: 'CEP destino ausente na OS/cotação — necessário para emitir CIOT AILOG.',
    };
  }

  const destDoc = digits(load.destDoc);
  if (destDoc.length !== 11 && destDoc.length !== 14) {
    return { ok: false, error: 'Destinatário sem CPF/CNPJ (cliente da OS).' };
  }

  const start = load.pickupDate ? new Date(load.pickupDate) : new Date();
  const end = load.eta ? new Date(load.eta) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const hasBank = Boolean(
    digits(load.bancoCodigo) && digits(load.bancoAgencia) && digits(load.bancoConta)
  );

  const veiculos: Array<{ placa: string; rntrc: string }> = [
    { placa: plate, rntrc: contratadoRntrc },
  ];
  const plate2 = formatPlateForCiot(load.plate2 || '');
  if (plate2.length === 7) {
    veiculos.push({ placa: plate2, rntrc: contratadoRntrc });
  }

  const originCity = ailogCidade({
    cidade: lookups.origin?.municipio || originParsed.cidade,
    uf: lookups.origin?.uf || originParsed.uf,
    ibge: lookups.origin?.ibge_code || load.originIbge,
  });
  const destCity = ailogCidade({
    cidade: lookups.dest?.municipio || load.destCidade || destParsed.cidade,
    uf: lookups.dest?.uf || load.destUf || destParsed.uf,
    ibge: lookups.dest?.ibge_code || load.destIbgeOverride || load.destIbge,
  });

  if (!originCity.codigoIbge) {
    return { ok: false, error: 'IBGE origem não resolvido (CEP/cotação).' };
  }
  if (!destCity.codigoIbge) {
    return { ok: false, error: 'IBGE destino não resolvido (CEP/cotação).' };
  }

  const input: AilogCiotEmitInput = {
    tipoViagem: load.tipoViagem,
    codigoCliente: load.osNumber,
    veiculos,
    documentoContratado: contratadoDoc,
    rntrcContratado: contratadoRntrc,
    nomeContratado: load.contratadoNome,
    documentoContratante: contratanteDoc,
    rntrcContratante: digits(load.contratanteRntrc),
    nomeContratante: load.contratanteNome,
    enderecoContratante: enderecoFromLookup(
      lookups.contratante,
      {
        cidade: load.contratanteCidade,
        uf: load.contratanteUf,
        ibge: load.contratanteIbge,
      },
      load.contratanteCep,
      {
        logradouro: load.contratanteLogradouro,
        numero: load.contratanteNumero,
        bairro: load.contratanteBairro,
        complemento: load.contratanteComplemento,
      }
    ),
    documentoDestinatario: destDoc,
    nomeDestinatario: load.destNome,
    enderecoDestinatario: enderecoFromLookup(
      lookups.dest,
      {
        cidade: destCity.cidade,
        uf: destCity.uf,
        ibge: Number(destCity.codigoIbge),
      },
      destCep,
      {
        logradouro: load.destLogradouro || undefined,
        numero: load.destNumero || undefined,
        bairro: load.destBairro || undefined,
      }
    ),
    codigoNaturezaCarga: '0001',
    cidadeOrigem: originCity,
    cepOrigem: load.originCep,
    cidadeDestino: destCity,
    cepDestino: destCep,
    dataInicioViagem: formatCiotDate(Number.isNaN(start.getTime()) ? new Date() : start),
    dataFimViagem: formatCiotDate(Number.isNaN(end.getTime()) ? new Date() : end),
    distanciaPercorrida: load.km,
    valorFrete: load.valorFrete,
    valorPedagio: load.valorPedagio,
    pesoCarga: load.pesoKg,
    tipoPagamento: hasBank ? 'CONTA_CORRENTE' : 'OUTROS',
    codigoBanco: hasBank ? digits(load.bancoCodigo) : '',
    agencia: hasBank ? digits(load.bancoAgencia) : '',
    numeroConta: hasBank ? String(load.bancoConta || '') : '',
    cpfProprietarioConta: hasBank ? digits(load.bancoCpfTitular || contratadoDoc) : '',
  };

  if (!digits(input.rntrcContratante)) {
    return { ok: false, error: 'VECTRA_RNTRC ausente (contratante).' };
  }

  return { ok: true, input };
}
