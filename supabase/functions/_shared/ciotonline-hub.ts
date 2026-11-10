/**
 * Monta o payload de POST /ciots (CIOT Online) a partir do HubCiotLoad da OS.
 * Puro (sem DB/rede). Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md §3
 */
import type { IbgeLookupResult } from './ibge-lookup.ts';
import {
  digits,
  formatCiotDate,
  formatPlateForCiot,
  parseCityUfLabel,
} from './ailog-ciot-client.ts';
import { ciotTripWindow, type HubCiotLoad } from './ailog-ciot-hub.ts';

export type CiotOnlinePagamento = 'PIX' | 'CONTA_CORRENTE' | 'OUTROS';

type Lookups = {
  origin: IbgeLookupResult | null;
  dest: IbgeLookupResult | null;
  contratante: IbgeLookupResult | null;
};

type Ponta = { cep: string; cidade: string; uf: string; codigo_ibge: number };

export type CiotOnlinePayload = {
  tipo_viagem: 1 | 3;
  codigo_cliente: string;
  codigo_natureza_carga: string;
  contratado: { documento: string; rntrc: string; nome: string };
  destinatario: {
    documento: string;
    rntrc: string;
    nome: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    codigo_ibge: number;
  };
  origem: Ponta;
  destino: Ponta;
  veiculos: Array<{ placa: string; rntrc: string; eixos?: number }>;
  data_inicio_viagem: string;
  data_fim_viagem: string;
  valor_frete: number;
  distancia_percorrida: number;
  peso_carga: number;
  valor_pedagio: number;
  tipo_pagamento: string;
  chave_pix?: string;
  codigo_banco?: string;
  agencia?: string;
  numero_conta?: string;
  cpf_proprietario_conta?: string;
};

export type CiotOnlineBuildResult =
  | { ok: true; payload: CiotOnlinePayload; pagamento: CiotOnlinePagamento }
  | { ok: false; error: string };

/** ANTT: 3 = TAC agregado; TAC independente e demais = 1. */
export function tipoViagemFromProprietario(tipo?: number | null): 1 | 3 {
  return tipo === 0 ? 3 : 1;
}

export function resolvePagamento(load: HubCiotLoad): {
  tipo_pagamento: CiotOnlinePagamento;
  chave_pix?: string;
  codigo_banco?: string;
  agencia?: string;
  numero_conta?: string;
  cpf_proprietario_conta?: string;
} {
  const titular = digits(load.bancoCpfTitular || load.contratadoDoc);
  const pix = String(load.pixKey ?? '').trim();
  if (pix) {
    return { tipo_pagamento: 'PIX', chave_pix: pix, cpf_proprietario_conta: titular };
  }
  if (digits(load.bancoCodigo) && digits(load.bancoAgencia) && digits(load.bancoConta)) {
    return {
      tipo_pagamento: 'CONTA_CORRENTE',
      codigo_banco: digits(load.bancoCodigo),
      agencia: digits(load.bancoAgencia),
      numero_conta: String(load.bancoConta).trim(),
      cpf_proprietario_conta: titular,
    };
  }
  return { tipo_pagamento: 'OUTROS' };
}

/** 'YYYY-MM-DD' (só data) → meio-dia de Brasília, para o fuso não deslocar o dia. */
function anchorDateOnly(v?: string | null): string | null | undefined {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T12:00:00-03:00`;
  return v;
}

/** dd/MM/yyyy (Brasília) → YYYY-MM-DD */
function isoDateBr(d: Date): string {
  const [dd, mm, yyyy] = formatCiotDate(d).split('/');
  return `${yyyy}-${mm}-${dd}`;
}

const reais = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

export function buildCiotOnlineEmit(
  load: HubCiotLoad,
  lookups: Lookups,
  now: Date = new Date()
): CiotOnlineBuildResult {
  const placa = formatPlateForCiot(load.plate);
  if (placa.length < 7) return { ok: false, error: 'Placa do veículo inválida para CIOT.' };

  const contratadoDoc = digits(load.contratadoDoc);
  if (contratadoDoc.length !== 11 && contratadoDoc.length !== 14) {
    return { ok: false, error: 'Contratado sem CPF/CNPJ (proprietário/motorista).' };
  }
  const contratadoRntrc = digits(load.contratadoRntrc);
  if (contratadoRntrc.length < 8) {
    return { ok: false, error: 'Contratado sem RNTRC (proprietário do veículo).' };
  }

  const destDoc = digits(load.destDoc);
  if (destDoc.length !== 11 && destDoc.length !== 14) {
    return { ok: false, error: 'Destinatário sem CPF/CNPJ (cliente da OS).' };
  }

  const originCep = digits(load.originCep);
  const destCep = digits(load.destCepOverride || load.destCep);
  if (originCep.length !== 8) return { ok: false, error: 'CEP de origem ausente na OS/cotação.' };
  if (destCep.length !== 8) return { ok: false, error: 'CEP de destino ausente na OS/cotação.' };

  const originParsed = parseCityUfLabel(load.originLabel);
  const destParsed = parseCityUfLabel(load.destLabel);
  const origem: Ponta = {
    cep: originCep,
    cidade: lookups.origin?.municipio || originParsed.cidade,
    uf: (lookups.origin?.uf || originParsed.uf || '').toUpperCase(),
    codigo_ibge: Number(lookups.origin?.ibge_code || load.originIbge || 0),
  };
  const destino: Ponta = {
    cep: destCep,
    cidade: lookups.dest?.municipio || load.destCidade || destParsed.cidade,
    uf: (lookups.dest?.uf || load.destUf || destParsed.uf || '').toUpperCase(),
    codigo_ibge: Number(lookups.dest?.ibge_code || load.destIbgeOverride || load.destIbge || 0),
  };
  if (!origem.codigo_ibge)
    return { ok: false, error: 'IBGE de origem não resolvido (CEP/cotação).' };
  if (!destino.codigo_ibge) {
    return { ok: false, error: 'IBGE de destino não resolvido (CEP/cotação).' };
  }
  if (!(Number(load.km) > 0)) return { ok: false, error: 'Distância (km) da OS ausente.' };

  const veiculo: { placa: string; rntrc: string; eixos?: number } = {
    placa,
    rntrc: contratadoRntrc,
  };
  if (Number(load.eixos) > 0) veiculo.eixos = Number(load.eixos);
  const veiculos = [veiculo];
  const placa2 = formatPlateForCiot(load.plate2 || '');
  if (placa2.length === 7) veiculos.push({ placa: placa2, rntrc: contratadoRntrc });

  const { start, end } = ciotTripWindow(
    { pickupDate: anchorDateOnly(load.pickupDate), eta: anchorDateOnly(load.eta) },
    now
  );

  const pagamento = resolvePagamento(load);

  return {
    ok: true,
    pagamento: pagamento.tipo_pagamento,
    payload: {
      tipo_viagem: tipoViagemFromProprietario(load.tipoProprietario),
      codigo_cliente: load.osNumber,
      codigo_natureza_carga: '0001',
      contratado: { documento: contratadoDoc, rntrc: contratadoRntrc, nome: load.contratadoNome },
      destinatario: {
        documento: destDoc,
        rntrc: '',
        nome: load.destNome,
        cep: destCep,
        logradouro: load.destLogradouro || lookups.dest?.logradouro || 'S/N',
        numero: load.destNumero || 'S/N',
        bairro: load.destBairro || lookups.dest?.bairro || 'Centro',
        cidade: destino.cidade,
        uf: destino.uf,
        codigo_ibge: destino.codigo_ibge,
      },
      origem,
      destino,
      veiculos,
      data_inicio_viagem: isoDateBr(start),
      data_fim_viagem: isoDateBr(end),
      valor_frete: reais(load.valorFrete),
      distancia_percorrida: Math.round(Number(load.km)),
      peso_carga: Math.round(Number(load.pesoKg) || 0),
      valor_pedagio: reais(load.valorPedagio),
      ...pagamento,
    },
  };
}
