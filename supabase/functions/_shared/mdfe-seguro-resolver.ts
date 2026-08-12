/**
 * Resolução de seguros_carga para MDF-e (RCTR-C / RC-DC).
 *
 * VECTRA HUB (Fairfax): averbação manual por e-mail MS/Fairfax até AT&M —
 * sem protocolo nAver. Enquanto isso, usa número da proposta (ex. 63433997322)
 * como nAver operacional (declaração Fairfax 0171/2026).
 */

export const FAIRFAX_CNPJ = '10793428000192';
export const BERKLEY_CNPJ = '07021544000189';

export type RiskPolicyRow = {
  code?: string | null;
  policy_type?: string | null;
  insurer?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type MdfeSeguroRow = {
  responsavel_seguro: '1';
  nome_seguradora: string;
  cnpj_seguradora: string;
  numero_apolice: string;
  numero_averbacao: string;
};

export type ResolveMdfeSegurosInput = {
  policies: RiskPolicyRow[];
  naverFromCte: string[];
  naverEnvOverride?: string;
  ambiente: 'homolog' | 'prod';
};

function digitsOnly(value: string | null | undefined, maxLen = 40): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, maxLen);
}

function cleanAverbacao(value: string | null | undefined, maxLen = 40): string {
  return String(value ?? '')
    .replace(/\s/g, '')
    .slice(0, maxLen);
}

/** Apólice: metadata.apolice → proposta → dígitos do code. */
export function resolveNumeroApolice(pol: RiskPolicyRow): string {
  const meta = pol.metadata ?? {};
  const fromMeta = digitsOnly(String(meta.numero_apolice ?? meta.apolice ?? ''));
  if (fromMeta) return fromMeta;
  const proposta = digitsOnly(String(meta.proposta ?? ''));
  if (proposta) return proposta;
  return digitsOnly(String(pol.code ?? '').replace(/^[^0-9]+-?/i, ''));
}

/** Seguradora CNPJ a partir de metadata ou nome. */
export function resolveInsurerCnpj(pol: RiskPolicyRow): string {
  const meta = pol.metadata ?? {};
  const fromMeta = digitsOnly(String(meta.insurer_cnpj ?? ''));
  if (fromMeta.length === 14) return fromMeta;
  const insurer = String(pol.insurer ?? '');
  if (/fairfax/i.test(insurer)) return FAIRFAX_CNPJ;
  if (/berkley/i.test(insurer)) return BERKLEY_CNPJ;
  return '';
}

/**
 * nAver: averbação AT&M do CT-e → metadata → proposta (modo email_ms) → secret.
 * CNSP: se RC-DC + RCTR-C ativos, MDF-e leva só RC-DC (55 inclui 54).
 */
export function resolveMdfeSeguros(input: ResolveMdfeSegurosInput): MdfeSeguroRow[] {
  const naverEnv = cleanAverbacao(input.naverEnvOverride);
  let policyRows = (input.policies ?? []).filter(
    (pol) => String(pol.metadata?.status ?? '') !== 'em_emissao'
  );

  // Só coberturas de carga no MDF-e (ignora RC-V).
  policyRows = policyRows.filter((pol) => {
    const t = String(pol.policy_type ?? '').toUpperCase();
    return (
      t === 'RCTR-C' || t === 'RC-DC' || t === 'RCFDC' || t.includes('RCTR') || t.includes('RC-DC')
    );
  });

  const hasRcDc = policyRows.some((p) => String(p.policy_type ?? '').toUpperCase() === 'RC-DC');
  const hasRctrC = policyRows.some((p) => String(p.policy_type ?? '').toUpperCase() === 'RCTR-C');
  if (hasRcDc && hasRctrC) {
    policyRows = policyRows.filter((p) => String(p.policy_type ?? '').toUpperCase() === 'RC-DC');
  }

  const seguros: MdfeSeguroRow[] = [];

  for (const pol of policyRows) {
    const apolice = resolveNumeroApolice(pol);
    const insurer = String(pol.insurer ?? 'Seguradora').trim();
    const cnpjSeg = resolveInsurerCnpj(pol);
    const meta = pol.metadata ?? {};

    const fromMeta = cleanAverbacao(String(meta.numero_averbacao ?? meta.averbacao ?? ''));
    const propostaFallback = digitsOnly(String(meta.proposta ?? ''));
    const emailMsMode = String(meta.averbacao_modo ?? '') === 'email_ms';

    let averbacao =
      input.naverFromCte[0] ||
      fromMeta ||
      (emailMsMode && propostaFallback ? propostaFallback : '') ||
      naverEnv ||
      (input.ambiente === 'homolog' ? propostaFallback || apolice : '');

    if (!averbacao || !apolice || !cnpjSeg) continue;

    seguros.push({
      responsavel_seguro: '1',
      nome_seguradora: insurer.slice(0, 30),
      cnpj_seguradora: cnpjSeg,
      numero_apolice: apolice,
      numero_averbacao: averbacao,
    });
  }

  return seguros;
}
