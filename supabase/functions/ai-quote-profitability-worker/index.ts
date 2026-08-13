// supabase/functions/ai-quote-profitability-worker/index.ts
//
// REGIME TRIBUTÁRIO: Lucro Presumido (vigente desde abril/2026)
// Migração de referência: 20260407100000_migrate_lucro_presumido.sql
//
// Alíquotas sob Lucro Presumido (Transporte Rodoviário de Cargas):
//   PIS:    0,65% cumulativo sobre receita bruta (destacado na NF)
//   COFINS: 3,00% cumulativo sobre receita bruta (destacado na NF)
//   IRPJ:   1,20% efetiva (8% base de presunção × 15% alíquota IRPJ)
//   CSLL:   1,08% efetiva (12% base de presunção × 9% alíquota CSLL)
//   DAS:    0,00% (DAS não existe no Lucro Presumido — era Simples Nacional)
//   ICMS:   variável por UF (tabela icms_rates) — NÃO incluído neste cálculo
//             interestadual: 7% ou 12% | interna: 17–18%
//
// Carga tributária fixa LP (PIS+COFINS+IRPJ+CSLL): 5,93%
//
// Fórmula margem:
//   gross_margin_pct = (receita_bruta - custo_direto) / receita_bruta × 100
//   net_margin_lp    = gross_margin_pct - (pis + cofins + irpj + csll)_pct
//
//   Nota: valores financeiros na tabela `quotes` são armazenados em BRL real
//   (DECIMAL/numeric), não em centavos. `pricing_breakdown` é o snapshot JSONB
//   do CalculateFreightResponse gerado por calculate-freight.
//
// Fonte dinâmica das alíquotas:
//   fetchPricingRulesConfig / resolvePricingRuleBackend (pricing-rules.ts)
// Fallback: constantes LP_DEFAULTS abaixo, se a linha não estiver no DB.

import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callGemini, type GeminiModel } from '../_shared/gemini.ts';
import { fetchPricingRulesConfig, resolvePricingRuleBackend } from '../_shared/pricing-rules.ts';
import type { FreightProfitability, FreightTotals } from '../_shared/freight-types.ts';

const Deno = (globalThis as any).Deno;

// ---------------------------------------------------------------------------
// LP_DEFAULTS — named fallback constants.
// Used only when pricing_rules_config rows are absent.
// Values derived from the Lucro Presumido migration sql:
//   20260407100000_migrate_lucro_presumido.sql
// ---------------------------------------------------------------------------
const LP_DEFAULTS = {
  pis_percent: 0.65, // PIS cumulativo, Art. 65 Lei 10.637/02 — sem crédito no LP
  cofins_percent: 3.0, // COFINS cumulativo, Art. 30 Lei 10.833/03 — sem crédito no LP
  irpj_effective_percent: 1.2, // 8% presunção (Transp. Cargas) × 15% alíquota = 1,20%
  csll_effective_percent: 1.08, // 12% presunção (Transp. Cargas) × 9% alíquota = 1,08%
} as const;

// ---------------------------------------------------------------------------
// Typing for the pricing_breakdown JSONB snapshot
// Mirrors CalculateFreightResponse shape (see _shared/freight-types.ts)
// ---------------------------------------------------------------------------
interface PricingBreakdownSnapshot {
  totals?: Partial<FreightTotals>;
  profitability?: Partial<FreightProfitability>;
  meta?: {
    billable_weight_kg?: number;
    margin_percent?: number;
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tax context resolved from pricing_rules_config
// ---------------------------------------------------------------------------
interface TaxRates {
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
  total: number; // sum of all four, in percentage points
  regime: 'lucro_presumido' | 'simples_nacional' | 'unknown';
  source: 'db' | 'fallback' | 'partial';
  fallbackKeys: string[];
}

async function resolveTaxRates(sb: ReturnType<typeof createClient>): Promise<TaxRates> {
  const allRules = await fetchPricingRulesConfig(sb, true);
  const fallbackKeys: string[] = [];

  const scope = { methodology: 'lotacao' as const, vehicleTypeId: null as string | null };
  const isLP = (resolvePricingRuleBackend(allRules, 'regime_lucro_presumido', scope) ?? 0) === 1;
  const isSN = (resolvePricingRuleBackend(allRules, 'regime_simples_nacional', scope) ?? 0) === 1;

  function resolveRate(key: keyof typeof LP_DEFAULTS): number {
    const dbValue = resolvePricingRuleBackend(allRules, key, scope);
    if (dbValue === undefined) {
      fallbackKeys.push(key);
      return LP_DEFAULTS[key];
    }
    return dbValue;
  }

  const pis = resolveRate('pis_percent');
  const cofins = resolveRate('cofins_percent');
  const irpj = resolveRate('irpj_effective_percent');
  const csll = resolveRate('csll_effective_percent');

  const source =
    fallbackKeys.length === 0
      ? 'db'
      : fallbackKeys.length === Object.keys(LP_DEFAULTS).length
        ? 'fallback'
        : 'partial';

  return {
    pis,
    cofins,
    irpj,
    csll,
    total: pis + cofins + irpj + csll,
    regime: isLP ? 'lucro_presumido' : isSN ? 'simples_nacional' : 'unknown',
    source,
    fallbackKeys,
  };
}

// ---------------------------------------------------------------------------
// Format a BRL value (stored as real reais in numeric/DECIMAL columns,
// NOT as integer centavos) for display in the AI prompt.
// ---------------------------------------------------------------------------
function formatBRL(brl: number | null | undefined): string {
  if (brl == null || !Number.isFinite(brl)) return 'N/A';
  return `R$ ${brl.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// Extract the revenue and direct cost from the pricing_breakdown snapshot.
//
// Primary source: pricing_breakdown.totals.receita_bruta  (gross revenue)
//                 pricing_breakdown.profitability.custos_diretos  (direct cost)
// Fallbacks:      quote.value (the quoted price column, also in BRL reais)
//                 pricing_breakdown.profitability.custo_motorista (legacy key)
// ---------------------------------------------------------------------------
interface FinancialExtract {
  receitaBruta: number | null;
  custosDiretos: number | null;
  margemPercentFromEngine: number | null;
  regimeFiscalFromEngine: string | null;
  resultadoLiquidoFromEngine: number | null;
}

function extractFinancialsFromBreakdown(
  breakdown: PricingBreakdownSnapshot | null | undefined,
  quoteValue: number | null | undefined
): FinancialExtract {
  const totals = breakdown?.totals;
  const prof = breakdown?.profitability;

  // receita_bruta is the canonical gross revenue stored by calculate-freight
  const receitaBruta =
    (totals?.receita_bruta ?? totals?.total_cliente) != null
      ? Number(totals!.receita_bruta ?? totals!.total_cliente)
      : quoteValue != null
        ? Number(quoteValue)
        : null;

  // custos_diretos = all direct costs before overhead and taxes
  // Fallback to custo_motorista (base carrier cost) for older breakdowns
  const custosDiretos =
    prof?.custos_diretos != null
      ? Number(prof.custos_diretos)
      : prof?.custo_motorista != null
        ? Number(prof.custo_motorista)
        : null;

  const margemPercentFromEngine = prof?.margem_percent != null ? Number(prof.margem_percent) : null;

  const regimeFiscalFromEngine = prof?.regime_fiscal ?? null;

  const resultadoLiquidoFromEngine =
    prof?.resultado_liquido != null ? Number(prof.resultado_liquido) : null;

  return {
    receitaBruta,
    custosDiretos,
    margemPercentFromEngine,
    regimeFiscalFromEngine,
    resultadoLiquidoFromEngine,
  };
}

// ---------------------------------------------------------------------------
// Validate that a GeminiModel string is one of the supported values.
// Prevents silent Gemini API errors from bad caller inputs.
// ---------------------------------------------------------------------------
const VALID_GEMINI_MODELS: ReadonlySet<GeminiModel> = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

function parseGeminiModel(raw: unknown): GeminiModel {
  if (typeof raw === 'string' && VALID_GEMINI_MODELS.has(raw as GeminiModel)) {
    return raw as GeminiModel;
  }
  return 'gemini-2.5-flash';
}

// ---------------------------------------------------------------------------
// Parse Gemini JSON response robustly — handles markdown fences and
// trailing garbage that occasionally appears in LLM output.
// ---------------------------------------------------------------------------
function parseGeminiJson(text: string): Record<string, unknown> {
  // Strip ```json ... ``` or ``` ... ``` fences
  const stripped = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  // Extract the first {...} block in case of extra prose
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new SyntaxError('No JSON object found in Gemini response');
  return JSON.parse(match[0]);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const start = Date.now();

  try {
    const body: { entityId: string; model?: unknown; previousInsights?: string } = await req.json();
    const { entityId, previousInsights } = body;
    const model: GeminiModel = parseGeminiModel(body.model);

    if (!entityId || typeof entityId !== 'string') {
      return new Response(JSON.stringify({ error: 'entityId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // -----------------------------------------------------------------------
    // 1. Fetch quote — use actual column names from the quotes schema.
    //    The table uses:
    //      - `origin` / `destination`  (not origin_city / destination_city)
    //      - `stage`                   (not status)
    //      - `value`                   (the quoted price in BRL reais)
    //      - No `total_value` or `freight_cost` columns exist.
    //    Revenue and cost figures come from pricing_breakdown (JSONB snapshot).
    // -----------------------------------------------------------------------
    const { data: quote, error: quoteError } = await sb
      .from('quotes')
      .select(
        [
          'id',
          'stage',
          'origin',
          'destination',
          'cargo_type',
          'weight',
          // billing/distance context
          'billable_weight',
          'km_distance',
          'toll_value',
          // financial core — value is the price quoted to the client (BRL reais)
          'value',
          'cargo_value',
          // full pricing snapshot (jsonb): contains totals, profitability, meta, rates
          'pricing_breakdown',
          // relations
          'client_name',
          'vehicle_type:vehicle_types(code, name)',
        ].join(', ')
      )
      .eq('id', entityId)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Quote ${entityId} not found: ${quoteError?.message ?? 'no data'}`);
    }

    const breakdown = (quote.pricing_breakdown ?? null) as PricingBreakdownSnapshot | null;

    // -----------------------------------------------------------------------
    // 2. Fetch current tax rates from pricing_rules_config (Lucro Presumido)
    // -----------------------------------------------------------------------
    const taxes = await resolveTaxRates(sb);

    // -----------------------------------------------------------------------
    // 3. Extract financial figures from pricing_breakdown snapshot.
    //    The calculate-freight function stores gross revenue in
    //    totals.receita_bruta and direct costs in profitability.custos_diretos.
    //    All values are in BRL reais (NOT integer centavos).
    // -----------------------------------------------------------------------
    const financials = extractFinancialsFromBreakdown(breakdown, (quote as any).value);

    // -----------------------------------------------------------------------
    // 4. Margin calculations.
    //
    //    gross_margin_pct = (receita_bruta - custos_diretos) / receita_bruta × 100
    //      Reflects what the pricing engine targets before tax deductions.
    //
    //    net_margin_lp = gross_margin_pct − (pis + cofins + irpj + csll)
    //      Deducts the four LP taxes as % of gross revenue.
    //      ICMS is excluded (route-dependent, already inside pricing_breakdown).
    //
    //    When pricing_breakdown.profitability.margem_percent is available,
    //    it is shown alongside for cross-validation — it may differ because
    //    the engine includes overhead and payment adjustments in its formula.
    // -----------------------------------------------------------------------
    let grossMarginPct: string | null = null;
    let netMarginLpPct: string | null = null;
    let taxBurdenBRL: string | null = null;

    if (
      financials.receitaBruta != null &&
      financials.custosDiretos != null &&
      financials.receitaBruta > 0
    ) {
      const grossFraction =
        (financials.receitaBruta - financials.custosDiretos) / financials.receitaBruta;
      const grossMarginNum = grossFraction * 100;

      // Tax burden as fraction of gross revenue
      const taxBurdenFraction = taxes.total / 100; // e.g. 5.93 / 100 = 0.0593
      const taxBurdenValue = financials.receitaBruta * taxBurdenFraction; // in BRL reais
      const netMarginNum = grossMarginNum - taxes.total;

      grossMarginPct = grossMarginNum.toFixed(1);
      netMarginLpPct = netMarginNum.toFixed(1);
      taxBurdenBRL = formatBRL(taxBurdenValue);
    } else if (financials.margemPercentFromEngine != null) {
      // Fallback: use the margin already computed by the pricing engine
      // This does not allow us to decompose gross vs net, but is better than N/A
      grossMarginPct = financials.margemPercentFromEngine.toFixed(1);
      netMarginLpPct = (financials.margemPercentFromEngine - taxes.total).toFixed(1);
      if (financials.receitaBruta != null && financials.receitaBruta > 0) {
        taxBurdenBRL = formatBRL(financials.receitaBruta * (taxes.total / 100));
      }
    }

    // -----------------------------------------------------------------------
    // 5. Build Gemini prompt — fully self-contained for interpretability
    //    without any external context, including years after this was written.
    // -----------------------------------------------------------------------
    const taxSourceNote =
      taxes.source === 'fallback'
        ? `[ATENÇÃO: TODAS as alíquotas (${taxes.fallbackKeys.join(', ')}) ausentes em pricing_rules_config — usando defaults LP hardcoded]`
        : taxes.source === 'partial'
          ? `[ATENÇÃO: alíquotas ${taxes.fallbackKeys.join(', ')} ausentes em pricing_rules_config — usando defaults LP para essas chaves]`
          : '[Alíquotas lidas dinamicamente de pricing_rules_config — fonte confiável]';

    const breakdownSection = breakdown
      ? `\nComposição do preço (pricing_breakdown.profitability):\n${JSON.stringify(
          breakdown.profitability ?? {},
          null,
          2
        )}\n\nTotais (pricing_breakdown.totals):\n${JSON.stringify(
          breakdown.totals ?? {},
          null,
          2
        )}`
      : '\nComposição do preço: não disponível (pricing_breakdown ausente)';

    const vehicleType = (quote as any).vehicle_type;
    const engineMarginNote =
      financials.margemPercentFromEngine != null
        ? `\n  Margem calculada pelo motor de precificação: ${financials.margemPercentFromEngine.toFixed(1)}% (inclui overhead e ajustes — pode diferir da margem bruta acima)`
        : '';

    const prompt = `Analise a rentabilidade desta cotação de frete da Vectra Cargo.
Responda SOMENTE com JSON válido no formato especificado ao final.

# CONTEXTO TRIBUTÁRIO — OBRIGATÓRIO PARA ANÁLISE CORRETA

Empresa: Vectra Cargo (Transporte Rodoviário de Cargas, CNPJ optante pelo Lucro Presumido desde abril/2026)
Regime tributário vigente: LUCRO PRESUMIDO
Migração de referência: supabase/migrations/20260407100000_migrate_lucro_presumido.sql
Vigência: abril/2026 em diante
${taxSourceNote}

Alíquotas Lucro Presumido aplicáveis a Transporte Rodoviário:
  PIS:    ${taxes.pis.toFixed(2)}% — regime cumulativo (Art. 65 Lei 10.637/02); destacado na NF de frete; sem crédito de entrada no LP
  COFINS: ${taxes.cofins.toFixed(2)}% — regime cumulativo (Art. 30 Lei 10.833/03); destacado na NF de frete; sem crédito de entrada no LP
  IRPJ:   ${taxes.irpj.toFixed(2)}% efetiva — base de presunção 8% (Transp. Cargas, RIR/99 Art. 223) × alíquota estatutária 15% = ${taxes.irpj.toFixed(2)}%; provisionado, NÃO destacado na NF
  CSLL:   ${taxes.csll.toFixed(2)}% efetiva — base de presunção 12% (Transp. Cargas, Lei 7.689/88) × alíquota estatutária 9% = ${taxes.csll.toFixed(2)}%; provisionado, NÃO destacado na NF
  DAS:    0,00% — DAS é exclusivo do Simples Nacional; não existe no Lucro Presumido
  ICMS:   variável por rota — interestadual 7% ou 12%; interna 17–18% (tabela icms_rates por UF); NÃO incluído nas margens abaixo pois varia por rota e já está em pricing_breakdown
  TOTAL PIS+COFINS+IRPJ+CSLL: ${taxes.total.toFixed(2)}%

Metodologia de cálculo de margens (adotada nesta análise):
  Margem bruta  = (Receita bruta − Custos diretos) / Receita bruta × 100
  Margem líquida LP = Margem bruta − ${taxes.total.toFixed(2)}% (carga tributária PIS+COFINS+IRPJ+CSLL sobre receita)
  Nota: ICMS não deduzido aqui pois varia por rota e já está no pricing_breakdown${engineMarginNote}

Valores calculados para esta cotação:
  Receita bruta: ${formatBRL(financials.receitaBruta)}
  Custos diretos: ${formatBRL(financials.custosDiretos)}
  Margem bruta: ${grossMarginPct ?? 'N/A'}%
  Carga tributária LP sobre receita (${taxes.total.toFixed(2)}%): ${taxBurdenBRL ?? 'N/A'}
  Margem líquida LP estimada (sem ICMS): ${netMarginLpPct ?? 'N/A'}%
  Resultado líquido (engine): ${formatBRL(financials.resultadoLiquidoFromEngine)}

Benchmarks de margem — Transporte Rodoviário de Cargas, regime LP (sem ICMS):
  Margem líquida saudável: ≥ 8%–12%
  Zona de atenção:          3%–8%
  Zona crítica:             < 3% (risco de prejuízo após ICMS e custos fixos residuais)
  Rejeição recomendada:     ≤ 0% (prejuízo certo após ICMS)

# DADOS DA COTAÇÃO

- ID: ${entityId}
- Origem → Destino: ${(quote as any).origin ?? 'N/A'} → ${(quote as any).destination ?? 'N/A'}
- Cliente: ${(quote as any).client_name ?? 'N/A'}
- Tipo de carga: ${(quote as any).cargo_type ?? 'N/A'}
- Peso real: ${(quote as any).weight ?? 0} kg | Peso taxado: ${(quote as any).billable_weight ?? 'N/A'} kg
- Veículo: ${vehicleType ? `${vehicleType.name} (${vehicleType.code})` : 'N/A'}
- Distância: ${(quote as any).km_distance ? `${(quote as any).km_distance} km` : 'N/A'}
- Valor da mercadoria: ${formatBRL((quote as any).cargo_value)}
- Valor cobrado ao cliente (receita bruta): ${formatBRL(financials.receitaBruta)}
- Pedágio: ${formatBRL((quote as any).toll_value)}
- Stage: ${(quote as any).stage ?? 'N/A'}
- Regime fiscal do motor: ${financials.regimeFiscalFromEngine ?? 'não disponível em pricing_breakdown'}
${breakdownSection}
${previousInsights ? `\nHistórico desta entidade:\n${previousInsights}` : ''}

# FORMATO DE RESPOSTA (JSON puro, sem markdown)

{
  "risk": "baixo" | "medio" | "alto",
  "summary": "análise em 2 frases considerando o regime Lucro Presumido e a margem líquida LP calculada",
  "margin_assessment": "comentário específico sobre margem líquida LP de ${netMarginLpPct ?? 'N/A'}% vs benchmark (≥8% saudável, 3-8% atenção, <3% crítico)",
  "tax_observation": "observação sobre impacto tributário LP nesta cotação (PIS+COFINS+IRPJ+CSLL = ${taxes.total.toFixed(2)}%) e risco ICMS pela rota",
  "recommendation": "aprovar | revisar | rejeitar — com justificativa financeira objetiva baseada nas margens e riscos identificados",
  "alerts": ["lista de alertas relevantes, ex: margem abaixo do mínimo, pedágio elevado, peso taxado diverge do real, pricing_breakdown ausente, regime fiscal divergente"]
}`;

    const { text, usage } = await callGemini(prompt, model);

    let analysis: Record<string, unknown>;
    try {
      analysis = parseGeminiJson(text);
    } catch (parseErr) {
      console.warn(
        '[ai-quote-profitability-worker] JSON parse failed, using raw text fallback:',
        parseErr
      );
      analysis = {
        risk: 'medio',
        summary: text.substring(0, 300),
        recommendation: 'Análise incompleta — resposta do modelo não era JSON válido.',
        alerts: ['parse_error: resposta do modelo não era JSON válido'],
      };
    }

    // -----------------------------------------------------------------------
    // 6. Persist result — upsert to avoid duplicate rows on retry.
    //    Include _tax_context in analysis for full auditability: any consumer
    //    of ai_insights can reconstruct the tax assumptions used at analysis time.
    // -----------------------------------------------------------------------
    const enrichedAnalysis = {
      ...analysis,
      _tax_context: {
        regime: taxes.regime,
        rates_source: taxes.source,
        pis_percent: taxes.pis,
        cofins_percent: taxes.cofins,
        irpj_effective_percent: taxes.irpj,
        csll_effective_percent: taxes.csll,
        total_lp_percent: taxes.total,
        gross_margin_pct: grossMarginPct != null ? Number(grossMarginPct) : null,
        net_margin_lp_pct: netMarginLpPct != null ? Number(netMarginLpPct) : null,
        receita_bruta_brl: financials.receitaBruta,
        custos_diretos_brl: financials.custosDiretos,
        resultado_liquido_brl: financials.resultadoLiquidoFromEngine,
        engine_margin_pct: financials.margemPercentFromEngine,
        regime_fiscal_engine: financials.regimeFiscalFromEngine,
        fallback_keys: taxes.fallbackKeys,
        calculated_at: new Date().toISOString(),
        migration_ref: '20260407100000_migrate_lucro_presumido.sql',
      },
    };

    // ai_insights has no UNIQUE constraint (only a btree index), so upsert is
    // not available. Delete any non-expired existing insight for this entity
    // before inserting the fresh result to prevent unbounded row accumulation
    // on retry. Expired rows (expires_at < now) are left for the expiry sweep.
    // expires_at: 24h — long enough for approval workflows spanning a business day.
    await sb
      .from('ai_insights')
      .delete()
      .eq('entity_type', 'quote')
      .eq('entity_id', entityId)
      .eq('insight_type', 'quote_profitability')
      .gt('expires_at', new Date().toISOString());

    await sb.from('ai_insights').insert({
      insight_type: 'quote_profitability',
      entity_type: 'quote',
      entity_id: entityId,
      analysis: enrichedAnalysis,
      summary_text: String(enrichedAnalysis.summary ?? ''),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(
      JSON.stringify({
        analysis: enrichedAnalysis,
        provider: 'gemini',
        model,
        usage,
        durationMs: Date.now() - start,
      }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (e) {
    console.error('[ai-quote-profitability-worker]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
