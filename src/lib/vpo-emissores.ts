/** Emissores VPO homologados no WebRouter ValePedagio + CNPJ FVPO (Focus). */

export const VPO_EMISSORES = ['SEMPARAR', 'CONECTCAR', 'VELOE', 'MOVEMAIS', 'REPOM'] as const;

export type VpoEmissor = (typeof VPO_EMISSORES)[number];

export type VpoVehicleLookup = {
  plate: string;
  emissor: VpoEmissor;
  tag: string | null;
  ativo: boolean;
  status: string;
  quantidadeEixos: number | null;
  nomeProprietario: string | null;
  descricao: string | null;
};

type VpoEmissorInfo = {
  codigo: VpoEmissor;
  nome: string;
  /** CNPJ da fornecedora de vale-pedágio (FVPO) — Focus `cnpj_fornecedora`. */
  cnpj: string;
};

export const VPO_EMISSOR_INFO: Record<VpoEmissor, VpoEmissorInfo> = {
  SEMPARAR: {
    codigo: 'SEMPARAR',
    nome: 'Sem Parar (CGMP)',
    // Sem Parar Instituição de Pagamento Ltda / CGMP — minuta Vale Pedágio Via Fácil
    cnpj: '04088208000165',
  },
  CONECTCAR: {
    codigo: 'CONECTCAR',
    nome: 'ConectCar',
    cnpj: '16545209000130',
  },
  VELOE: {
    codigo: 'VELOE',
    nome: 'Veloe',
    cnpj: '19527639000150',
  },
  MOVEMAIS: {
    codigo: 'MOVEMAIS',
    nome: 'Move Mais',
    cnpj: '13485710000107',
  },
  REPOM: {
    codigo: 'REPOM',
    nome: 'Repom',
    cnpj: '03007231000110',
  },
};

export function normalizePlate(plate: string | null | undefined): string {
  return (plate || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function fornecedoraCnpjOf(emissor: VpoEmissor): string {
  return VPO_EMISSOR_INFO[emissor].cnpj;
}

export type VpoConsultInput = {
  emissor?: string | null;
  placa?: string | null;
  tag?: string | null;
  ativo?: boolean;
  status?: string | null;
  quantidadeEixos?: number | null;
  nomeProprietario?: string | null;
  descricao?: string | null;
};

export function isVpoEmissor(v: string | null | undefined): v is VpoEmissor {
  return (VPO_EMISSORES as readonly string[]).includes(String(v || '').toUpperCase());
}

/** Mapeia resposta live `consultarVeiculo` → lookup da aba VPO. */
export function vpoLookupFromConsult(
  raw: VpoConsultInput | null | undefined
): VpoVehicleLookup | null {
  if (!raw) return null;
  const emissorRaw = String(raw.emissor || '').toUpperCase();
  if (!isVpoEmissor(emissorRaw)) return null;
  const plate = normalizePlate(raw.placa);
  if (!plate) return null;
  const tagRaw = raw.tag != null ? String(raw.tag).trim() : '';
  return {
    plate,
    emissor: emissorRaw,
    tag: tagRaw || null,
    ativo: Boolean(raw.ativo),
    status: String(raw.status || ''),
    quantidadeEixos: raw.quantidadeEixos != null ? Number(raw.quantidadeEixos) || null : null,
    nomeProprietario: raw.nomeProprietario != null ? String(raw.nomeProprietario) : null,
    descricao: raw.descricao != null ? String(raw.descricao) : null,
  };
}

/** Live ganha. Miss após fetch não usa catálogo de outra placa. Pending → fallback. */
export function resolveVpoVehicleForUi(opts: {
  live: VpoVehicleLookup | null;
  catalog: VpoVehicleLookup | null;
  liveFetched: boolean;
}): VpoVehicleLookup | null {
  if (opts.live) return opts.live;
  if (opts.liveFetched) return null;
  return opts.catalog ?? null;
}

/** Emitir VPO não depende do catálogo estático — Edge consulta WebRouter. */
export function canEmitVpo(opts: {
  canManage: boolean;
  tollFree: boolean;
  plate: string | null | undefined;
  persistedId: string | null | undefined;
  emitPending: boolean;
  vehicleAtivo?: boolean;
}): boolean {
  return (
    opts.canManage &&
    !opts.tollFree &&
    Boolean(normalizePlate(opts.plate)) &&
    !String(opts.persistedId || '').trim() &&
    !opts.emitPending
  );
}

/**
 * Fallback local (QJL1771). Fonte da verdade = Edge `consultar-vpo-veiculo`.
 */
const KNOWN_VPO_VEHICLES: Record<string, VpoVehicleLookup> = {
  QJL1771: {
    plate: 'QJL1771',
    emissor: 'SEMPARAR',
    tag: '0737371360',
    ativo: true,
    status: 'SUCESSO',
    quantidadeEixos: 3,
    nomeProprietario: 'SILVIO ADRIANO',
    descricao: 'IVECO CAT>1 ECTECTOR - CAT 03- 03 EIXOS ROD DUPLA',
  },
};

export function lookupVpoVehicleByPlate(plate: string | null | undefined): VpoVehicleLookup | null {
  const key = normalizePlate(plate);
  if (!key) return null;
  return KNOWN_VPO_VEHICLES[key] ?? null;
}

export function tipoValeFromLookup(lookup: VpoVehicleLookup | null): '01' | '04' {
  if (lookup?.tag) return '01';
  return '04';
}

/** Modalidade SemParar/WebRouter ValePedagio — NÃO confundir com tipoVale 01/04 (MDF-e). */
export const VPO_TIPOS_VIAGEM = ['ESTENDIDA', 'PLANEJADA', 'CUSTOMIZADA'] as const;
export type VpoTipoViagem = (typeof VPO_TIPOS_VIAGEM)[number];
export const DEFAULT_VPO_TIPO_VIAGEM: VpoTipoViagem = 'ESTENDIDA';

export function normalizeVpoTipoViagem(raw: unknown): VpoTipoViagem | null {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
  if (!s) return null;
  if (s.includes('ESTENDIDA') || s.includes('EXTENDED')) return 'ESTENDIDA';
  if (s.includes('PLANEJADA') || s.includes('FIXA') || s.includes('PLANNED')) return 'PLANEJADA';
  if (s.includes('CUSTOMIZADA') || s.includes('CUSTOM') || s.includes('FLEX')) return 'CUSTOMIZADA';
  return (VPO_TIPOS_VIAGEM as readonly string[]).includes(s) ? (s as VpoTipoViagem) : null;
}

export function labelVpoTipoViagem(tipo: string | null | undefined): string {
  const n = normalizeVpoTipoViagem(tipo);
  if (n === 'ESTENDIDA') return 'Rota Estendida';
  if (n === 'PLANEJADA') return 'Rota Planejada';
  if (n === 'CUSTOMIZADA') return 'Rota Customizada';
  const t = String(tipo ?? '').trim();
  return t || '—';
}

export function resolveIdVpo(
  record:
    | {
        idANTT?: string | null;
        idVpo?: string | null;
        codigoViagem?: string | null;
        idViagemOSA?: number | null;
        idViagemAILog?: number | null;
      }
    | null
    | undefined
): string {
  if (!record) return '';
  return (
    (record.idANTT && String(record.idANTT).trim()) ||
    (record.idVpo && String(record.idVpo).trim()) ||
    (record.codigoViagem && String(record.codigoViagem).trim()) ||
    (record.idViagemOSA ? String(record.idViagemOSA) : '') ||
    (record.idViagemAILog ? String(record.idViagemAILog) : '') ||
    ''
  );
}
