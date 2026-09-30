/**
 * Limite Máximo de Garantia (LMG) aplicável a um embarque — apólices Fairfax VECTRA HUB.
 * Paridade obrigatória com src/lib/insurance-limit.ts
 *
 * Fonte: apólice RC-DC 6550008359 (Fairfax), item 13:
 *   - Equipamentos de academia: R$ 3.000.000,00 por veículo/acúmulo
 *   - Cobertura básica: R$ 600.000,00
 *   - Origem, destino e/ou passagem pela Região Metropolitana do RJ: R$ 600.000,00
 * Valores vêm de risk_policies.metadata.lmg_breakdown (reais); coverage_limit = base.
 */

/** Municípios da Região Metropolitana do Rio de Janeiro (IBGE, LC-RJ 184/2018). */
export const RJ_METRO_IBGE: ReadonlySet<number> = new Set([
  3304557, // Rio de Janeiro
  3300456, // Belford Roxo
  3300803, // Cachoeiras de Macacu
  3301702, // Duque de Caxias
  3301850, // Guapimirim
  3301900, // Itaboraí
  3302007, // Itaguaí
  3302270, // Japeri
  3302502, // Magé
  3302700, // Maricá
  3302858, // Mesquita
  3303203, // Nilópolis
  3303302, // Niterói
  3303500, // Nova Iguaçu
  3303609, // Paracambi
  3303906, // Petrópolis
  3304144, // Queimados
  3304300, // Rio Bonito
  3304904, // São Gonçalo
  3305109, // São João de Meriti
  3305554, // Seropédica
  3305752, // Tanguá
]);

export type LmgBreakdown = {
  /** Equipamentos de academia (reais). */
  academia?: number;
  /** Qualquer mercadoria com origem/destino/passagem RM-RJ (reais). */
  rj_metropolitano?: number;
  /** Equipamentos de academia com origem/destino/passagem RM-RJ (reais). */
  academia_rj?: number;
};

export type LimitPolicy = {
  policy_type?: string | null;
  coverage_limit?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

export type LimitContext = {
  cargoType?: string | null;
  originIbge?: number | string | null;
  destinationIbge?: number | string | null;
  originUf?: string | null;
  destinationUf?: string | null;
  /** UFs de percurso (MDF-e / roteirização), se conhecidas. */
  routeUfs?: string[] | null;
};

export type RjTouch = 'origem' | 'destino' | 'percurso' | null;

export type LimitBasis = 'base' | 'academia' | 'rj_metropolitano' | 'academia_rj';

export type ResolvedLimit = {
  limit: number;
  basis: LimitBasis;
  rjTouch: RjTouch;
  academia: boolean;
  /** Texto para UI/formulário MS. */
  label: string;
};

export type LimitCheck = ResolvedLimit & {
  ok: boolean;
  cargoValue: number;
  /** Quanto excede o limite (0 quando ok). */
  excess: number;
};

const NON_FITNESS = /\b(QUIMIC|ALIMENT|BEBID|ELETRON|CELULAR|MEDICAMENT|COMBUST)/;

/**
 * VECTRA HUB transporta equipamento fitness (EQUIPAMENTOS, ESTEIRAS, ACESSÓRIOS…).
 * Default = academia; só sai da classe se o tipo indicar outra mercadoria.
 */
export function isAcademiaCargo(cargoType: string | null | undefined): boolean {
  const t = String(cargoType ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
  if (!t) return true;
  return !NON_FITNESS.test(t);
}

function toIbge(v: number | string | null | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isRj(uf: string | null | undefined): boolean {
  return (
    String(uf ?? '')
      .trim()
      .toUpperCase() === 'RJ'
  );
}

/**
 * Origem/destino: IBGE na RM-RJ. Sem IBGE, UF=RJ conta (conservador).
 * Percurso: qualquer UF RJ intermediária conta (conservador — BR-116/Dutra cruzam a RM).
 */
export function touchesRjMetro(ctx: LimitContext): RjTouch {
  const o = toIbge(ctx.originIbge);
  const d = toIbge(ctx.destinationIbge);
  if (o != null ? RJ_METRO_IBGE.has(o) : isRj(ctx.originUf)) return 'origem';
  if (d != null ? RJ_METRO_IBGE.has(d) : isRj(ctx.destinationUf)) return 'destino';
  if ((ctx.routeUfs ?? []).some(isRj)) return 'percurso';
  return null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function readLmgBreakdown(policy: LimitPolicy): LmgBreakdown {
  const raw = (policy.metadata?.lmg_breakdown ?? {}) as Record<string, unknown>;
  return {
    academia: num(raw.academia) ?? undefined,
    rj_metropolitano: num(raw.rj_metropolitano) ?? undefined,
    academia_rj: num(raw.academia_rj) ?? undefined,
  };
}

function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function resolveCoverageLimit(policy: LimitPolicy, ctx: LimitContext): ResolvedLimit {
  const base = num(policy.coverage_limit) ?? 0;
  const lmg = readLmgBreakdown(policy);
  const academia = isAcademiaCargo(ctx.cargoType);
  const rjTouch = touchesRjMetro(ctx);

  let limit = base;
  let basis: LimitBasis = 'base';
  if (academia && lmg.academia) {
    limit = lmg.academia;
    basis = 'academia';
  }
  if (rjTouch) {
    const rjLimit = (academia ? lmg.academia_rj : undefined) ?? lmg.rj_metropolitano;
    if (rjLimit && (limit === 0 || rjLimit < limit)) {
      limit = rjLimit;
      basis = academia && lmg.academia_rj ? 'academia_rj' : 'rj_metropolitano';
    }
  }

  const labels: Record<LimitBasis, string> = {
    base: 'LMG cobertura básica',
    academia: 'LMG equipamentos de academia',
    rj_metropolitano: `Sublimite RJ metropolitano (${rjTouch ?? ''})`,
    academia_rj: `Sublimite academia RJ metropolitano (${rjTouch ?? ''})`,
  };
  return { limit, basis, rjTouch, academia, label: `${labels[basis]}: ${brl(limit)}` };
}

export function checkCoverageLimit(
  policy: LimitPolicy,
  cargoValue: number,
  ctx: LimitContext
): LimitCheck {
  const r = resolveCoverageLimit(policy, ctx);
  const value = Number(cargoValue) || 0;
  const ok = r.limit <= 0 || value <= r.limit;
  return { ...r, ok, cargoValue: value, excess: ok ? 0 : value - r.limit };
}

/**
 * Apólice de referência para limite: RC-DC (inclui RCTR-C) > RCTR-C > primeira ativa.
 * Determinístico — não depende de created_at.
 */
export function pickReferencePolicy<T extends LimitPolicy>(policies: T[]): T | null {
  const by = (t: string) =>
    policies.find((p) => String(p.policy_type ?? '').toUpperCase() === t) ?? null;
  return by('RC-DC') ?? by('RCTR-C') ?? policies[0] ?? null;
}
