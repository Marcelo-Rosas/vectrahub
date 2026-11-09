/**
 * Pré-preenchimento do formulário MS "Liberação de embarque excepcional" a partir da OS/cotação.
 * O operador revisa/edita antes de enviar.
 */
import type { LimitCheck } from '@/lib/insurance-limit';
import type { MsCheckKey, MsLiberacaoForm, MsTextKey } from '@/lib/ms-liberacao-form';

export type PrefillPolicy = {
  policy_type?: string | null;
  code?: string | null;
  coverage_limit?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

export type DriverContract = 'proprio' | 'agregado' | 'terceiro' | null | undefined;

export type PrefillInput = {
  policies: PrefillPolicy[];
  check: LimitCheck;
  cargoType?: string | null;
  shipperName?: string | null;
  consigneeName?: string | null;
  nfeKeys?: string[] | null;
  origin?: string | null;
  destination?: string | null;
  plannedStart?: Date | null;
  vehiclePlate?: string | null;
  vehicleTypeName?: string | null;
  driverContract?: DriverContract;
  riskManager?: string | null;
};

export const VECTRA_SEGURADO = 'VECTRA HUB LTDA — CNPJ 62.188.748/0001-17';

export function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** nNF = posições 26–34 da chave NF-e (44 dígitos). */
export function nfNumeroFromChave(chave: string): string | null {
  const d = String(chave ?? '').replace(/\D/g, '');
  if (d.length !== 44) return null;
  return String(Number(d.slice(25, 34)));
}

function policyNumber(p: PrefillPolicy): string {
  const m = p.metadata ?? {};
  return String(m.apolice ?? m.numero_apolice ?? m.proposta ?? p.code ?? '').trim();
}

const RJ_TOUCH_LABEL = { origem: 'origem', destino: 'destino', percurso: 'passagem' } as const;

export function buildMsFormPrefill(input: PrefillInput): MsLiberacaoForm {
  const byType = (t: string) =>
    input.policies.find((p) => String(p.policy_type ?? '').toUpperCase() === t);
  const rcdc = byType('RC-DC');
  const rctrc = byType('RCTR-C');
  const { check } = input;

  const lmgParts: string[] = [];
  const base = Number((rcdc ?? rctrc)?.coverage_limit ?? 0);
  if (base > 0) lmgParts.push(`${brl(base)} (cobertura básica)`);
  const academiaLmg = Number(
    ((rcdc ?? rctrc)?.metadata?.lmg_breakdown as Record<string, unknown> | undefined)?.academia ?? 0
  );
  if (academiaLmg > 0) lmgParts.push(`${brl(academiaLmg)} (equipamentos de academia)`);

  const nfs = (input.nfeKeys ?? []).map(nfNumeroFromChave).filter((n): n is string => !!n);

  const text: Partial<Record<MsTextKey, string>> = {
    segurado_nome: VECTRA_SEGURADO,
    apolice_numero_1: rcdc
      ? `RC-DC ${policyNumber(rcdc)}`
      : rctrc
        ? `RCTR-C ${policyNumber(rctrc)}`
        : '',
    apolice_numero_2: rcdc && rctrc ? `RCTR-C ${policyNumber(rctrc)}` : '',
    lmg: lmgParts.join(' / '),
    sublimite: check.rjTouch
      ? `${brl(check.limit)} — ${RJ_TOUCH_LABEL[check.rjTouch]} Região Metropolitana do Rio de Janeiro`
      : '',
    motivo_esclarecer: check.ok
      ? ''
      : `Valor da carga ${brl(check.cargoValue)} excede ${check.label} (excesso ${brl(check.excess)}).`,
    mercadoria_tipo: check.academia
      ? `Equipamentos de academia (NCM 9506.91.00)${input.cargoType ? ` — ${input.cargoType.trim()}` : ''}`
      : String(input.cargoType ?? '').trim(),
    mercadoria_valor: brl(check.cargoValue),
    embarcador: String(input.shipperName ?? '').trim(),
    destinatario: String(input.consigneeName ?? '').trim(),
    notas_fiscais: nfs.length ? `NF-e ${nfs.join(', ')}` : '',
    conhecimento: 'A emitir após autorização',
    origem: input.origin ? `${input.origin.trim()}/Brasil` : '',
    destino: input.destination ? `${input.destination.trim()}/Brasil` : '',
    mercadoria_usada: 'Não',
    container: 'Não',
    percurso_fluvial: 'Não',
    previsao_inicio: input.plannedStart
      ? input.plannedStart.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : '',
    transportadora: 'VECTRA HUB LTDA',
    placa: String(input.vehiclePlate ?? '').toUpperCase(),
    gerenciadora: String(input.riskManager ?? 'Buonny'),
  };

  const contract = input.driverContract;
  const vt = String(input.vehicleTypeName ?? '').toUpperCase();
  const checks: Partial<Record<MsCheckKey, boolean>> = {
    apolice_rcf_dc: !!rcdc,
    apolice_rctr_c: !!rctrc,
    motivo_limite: !check.ok,
    modal_rodoviario: true,
    veiculo_frotista: contract === 'proprio',
    veiculo_agregado: contract === 'agregado',
    veiculo_terceiro: contract === 'terceiro',
    motorista_frotista: contract === 'proprio',
    motorista_agregado: contract === 'agregado',
    motorista_terceiro: contract === 'terceiro',
    tipo_utilitario: /UTILIT|VAN|FIORINO/.test(vt),
    tipo_caminhao: !/UTILIT|VAN|FIORINO/.test(vt),
    escolta_nao: true,
  };

  return { text, checks };
}
