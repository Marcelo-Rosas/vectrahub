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

/**
 * Consultas WebRouter `consultarVeiculo` já validadas (produção).
 * Enquanto a Edge não consulta ao vivo, a aba VPO usa este mapa.
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
