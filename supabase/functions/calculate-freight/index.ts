/// <reference path="deno.d.ts" />
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { calculateFreightInputSchema } from '../_shared/freight-schema.ts';
import {
  FREIGHT_CONSTANTS,
  type CalculateFreightInput,
  type CalculateFreightResponse,
  type FreightMeta,
  type FreightComponents,
  type FreightRates,
  type FreightTotals,
  type FreightProfitability,
  extractUf,
  extractCity,
  formatRouteUf,
  normalizeIcmsRate,
  calculateCubageWeight,
  calculateBillableWeight,
  roundCurrency,
  getMarginStatus,
  sumRiskRepasse,
  calculateGrossUpHibrido,
} from '../_shared/freight-types.ts';
import {
  ANTT_FLOOR_DEFAULT_FLAGS,
  computeAnttPisoCarreteiroReais,
  resolveAnttOperationTable,
} from '../_shared/antt-floor-calc.ts';
import { resolveAnttCargoTypeForPiso } from '../_shared/antt-cargo-type-map.ts';
import {
  calculateLotacaoProfitability,
  estimateInsuranceRiskCosts,
  LOTACAO_OVER_ANTT_KEY,
  resolveLotacaoFretePeso,
  resolveLotacaoKmOverPercent,
} from '../_shared/lotacao-freight-base.ts';

type WaitingRuleRow = {
  free_hours?: number | null;
  rate_per_hour?: number | null;
  rate_per_day?: number | null;
  min_charge?: number | null;
};

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use ANON_KEY + user JWT (respects RLS); requires verify_jwt = true

    // Use Deno.env only if running in Deno, fallback for other runtimes (e.g., Node test or local dev)
    const getEnvSafe = (key: string) => {
      if (typeof Deno !== 'undefined' && Deno.env && typeof Deno.env.get === 'function') {
        return Deno.env.get(key);
      } else if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
      }
      return undefined;
    };

    const supabaseUrl = getEnvSafe('SUPABASE_URL');
    const supabaseAnonKey = getEnvSafe('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'SERVER_ERROR',
          errors: ['Environment variables SUPABASE_URL or SUPABASE_ANON_KEY not set'],
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'UNAUTHORIZED',
          errors: ['Authorization header obrigatório'],
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'UNAUTHORIZED',
          errors: ['Usuário não autenticado'],
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate payload with Zod
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'MISSING_DATA',
          errors: ['Payload JSON inválido'],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = calculateFreightInputSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return new Response(JSON.stringify({ success: false, status: 'MISSING_DATA', errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const input: CalculateFreightInput = parseResult.data;

    console.log(
      '[calculate-freight] Request:',
      input.origin,
      '→',
      input.destination,
      `${input.km_distance}km`
    );

    const fallbacksApplied: string[] = [];

    // =====================================================
    // GET PARAMETERS (pricing_rules_config — única fonte de verdade, VEC-126)
    // =====================================================

    // VEC-120: query única captura id + axes_count para evitar roundtrip duplicado (reusado em WAITING TIME e ANTT floor)
    let vehicleTypeIdForRules: string | null = null;
    let vehicleTypeAxesCountForRules: number | null = null;
    if (input.vehicle_type_code) {
      const { data: vt } = await supabase
        .from('vehicle_types')
        .select('id, axes_count')
        .eq('code', input.vehicle_type_code)
        .eq('active', true)
        .maybeSingle();
      vehicleTypeIdForRules = vt?.id ?? null;
      vehicleTypeAxesCountForRules = vt?.axes_count ?? null;
    }

    const { data: allRules } = await supabase
      .from('pricing_rules_config')
      .select('key, value, vehicle_type_id, min_value, max_value, methodology')
      .eq('is_active', true);

    type PriceTableMethodology = 'lotacao' | 'fracionado_ntc' | 'fracionado_parceiro';
    let methodology: PriceTableMethodology = 'lotacao';
    let modality: 'lotacao' | 'fracionado' = 'lotacao';

    if (input.price_table_id) {
      const { data: ptEarly } = await supabase
        .from('price_tables')
        .select('modality, methodology, ad_valorem_lotacao_percent')
        .eq('id', input.price_table_id)
        .maybeSingle();
      if (ptEarly?.modality === 'fracionado') modality = 'fracionado';
      const m = ptEarly?.methodology;
      if (m === 'lotacao' || m === 'fracionado_ntc' || m === 'fracionado_parceiro') {
        methodology = m;
      } else if (!m) {
        return new Response(JSON.stringify({ error: 'Tabela sem methodology' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const hasHubFiscal = methodology === 'lotacao' || methodology === 'fracionado_ntc';

    function resolveRule(key: string, vtId: string | null | undefined): number | undefined {
      if (!allRules?.length) return undefined;
      const byKey = allRules.filter(
        (r: { key: string; methodology?: string }) =>
          r.key === key && (r.methodology ?? 'lotacao') === methodology
      );
      if (byKey.length === 0) return undefined;
      const vehicleRule = vtId
        ? byKey.find((r: { vehicle_type_id: string | null }) => r.vehicle_type_id === vtId)
        : null;
      const globalRule = byKey.find(
        (r: { vehicle_type_id: string | null }) => r.vehicle_type_id == null
      );
      const rule = vehicleRule ?? globalRule;
      if (!rule) return undefined;
      let val = Number(rule.value);
      if (rule.min_value != null && val < Number(rule.min_value)) val = Number(rule.min_value);
      if (rule.max_value != null && val > Number(rule.max_value)) val = Number(rule.max_value);
      return val;
    }

    // VEC-126: pricing_parameters depreciado — pricing_rules_config é a única fonte de verdade
    let cubageFactor = FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;
    const dasPercent = hasHubFiscal
      ? (input.das_percent ??
        resolveRule('das_percent', vehicleTypeIdForRules) ??
        FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT)
      : 0;
    const markupPercent = hasHubFiscal
      ? (input.markup_percent ??
        resolveRule('markup_percent', vehicleTypeIdForRules) ??
        FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT)
      : 0;
    const overheadPercent = hasHubFiscal
      ? (input.overhead_percent ??
        resolveRule('overhead_percent', vehicleTypeIdForRules) ??
        FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT)
      : 0;

    const regimeSimplesNacional = hasHubFiscal
      ? (input.regime_simples_nacional ??
        (resolveRule('regime_simples_nacional', vehicleTypeIdForRules) ?? 1) === 1)
      : false;
    const excessoSublimite = hasHubFiscal
      ? (input.excesso_sublimite ??
        (resolveRule('excesso_sublimite', vehicleTypeIdForRules) ?? 0) === 1)
      : false;

    const pisPercent = hasHubFiscal
      ? (input.pis_percent ?? resolveRule('pis_percent', vehicleTypeIdForRules) ?? 0)
      : 0;
    const cofinsPercent = hasHubFiscal
      ? (input.cofins_percent ?? resolveRule('cofins_percent', vehicleTypeIdForRules) ?? 0)
      : 0;
    const irpjEffectivePercent = hasHubFiscal
      ? (input.irpj_percent ?? resolveRule('irpj_effective_percent', vehicleTypeIdForRules) ?? 0)
      : 0;
    const csllEffectivePercent = hasHubFiscal
      ? (input.csll_percent ?? resolveRule('csll_effective_percent', vehicleTypeIdForRules) ?? 0)
      : 0;
    let regimeLucroPresumido = hasHubFiscal
      ? (input.regime_lucro_presumido ??
        (resolveRule('regime_lucro_presumido', vehicleTypeIdForRules) ?? 0) === 1)
      : false;
    if (
      hasHubFiscal &&
      !regimeLucroPresumido &&
      !regimeSimplesNacional &&
      (pisPercent > 0 || cofinsPercent > 0)
    ) {
      regimeLucroPresumido = true;
    }

    const carreteiroPercent = input.carreteiro_percent ?? 0;
    const descargaValue = input.descarga_value ?? 0;
    const aluguelMaquinasValue = input.aluguel_maquinas_value ?? 0;

    const correctionFactor = resolveRule('correction_factor_inctf', vehicleTypeIdForRules) ?? 1.0;

    const isSimples = regimeSimplesNacional && !excessoSublimite && !regimeLucroPresumido;

    // NTC Lotação Dez/25: correctionFactor e markup não aplicados ao frete peso
    fallbacksApplied.push('ntc_mode: correctionFactor/markup ignored');
    fallbacksApplied.push(`methodology: ${methodology}`);

    // =====================================================
    // CALCULATE WEIGHTS — max(kg, m³ × fator de cubagem); sem trava de 1 t
    // =====================================================

    const originalWeightKg = input.weight_kg;
    let cubageWeightKg = input.volume_m3 * cubageFactor;
    let billableWeightKg = Math.max(input.weight_kg, cubageWeightKg);

    // =====================================================
    // GET PRICE TABLE ROW
    // =====================================================

    let baseCost = 0;
    let grisPercent = 0;
    let tsoPercent = 0;
    let costValuePercent = 0;
    let kmBandLabel: string | null = null;
    let kmStatus: 'OK' | 'OUT_OF_RANGE' = 'OK';
    let responseStatus: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA' = 'OK';
    let responseError: string | undefined;
    let kmBandUsed: number | undefined;
    let priceTableRowId: string | undefined;

    const toFiniteNumber = (value: unknown): number | undefined => {
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };

    const resolveRulePercent = (key: string): number | undefined =>
      toFiniteNumber(resolveRule(key, vehicleTypeIdForRules));

    // Ad Valorem Lotação — resolve from Central de Riscos (may be overridden by price_tables)
    const adValoremResolved = resolveRulePercent('ad_valorem_lotacao_percent');
    if (adValoremResolved == null)
      fallbacksApplied.push(
        `ad_valorem_lotacao_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_AD_VALOREM_LOTACAO_PERCENT}`
      );
    let adValoremLotacaoPercent =
      adValoremResolved ?? FREIGHT_CONSTANTS.DEFAULT_AD_VALOREM_LOTACAO_PERCENT;

    // =====================================================
    // DETECT MODALITY / METHODOLOGY (already resolved above from price_tables)
    // =====================================================

    // Per-table ad_valorem takes precedence over pricing_rules_config
    if (input.price_table_id) {
      const { data: ptData } = await supabase
        .from('price_tables')
        .select('ad_valorem_lotacao_percent')
        .eq('id', input.price_table_id)
        .maybeSingle();
      const tableAdValorem = toFiniteNumber(ptData?.ad_valorem_lotacao_percent);
      if (tableAdValorem != null) {
        adValoremLotacaoPercent = tableAdValorem;
        fallbacksApplied.push(
          `ad_valorem_lotacao_percent: sobrescrito pela tabela (${tableAdValorem}%)`
        );
      }
    }

    const marginKey =
      methodology === 'fracionado_parceiro'
        ? 'profit_margin_parceiro_fracionado_percent'
        : methodology === 'fracionado_ntc'
          ? 'profit_margin_fracionado_percent'
          : 'profit_margin_lotacao_percent';

    const profitMarginPercent =
      resolveRule(marginKey, vehicleTypeIdForRules) ??
      (methodology === 'lotacao'
        ? resolveRule('profit_margin_percent', vehicleTypeIdForRules)
        : undefined) ??
      FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;

    // =====================================================
    // LTL PARAMETERS (mínimos NTC para fracionado)
    // =====================================================

    type LtlParams = {
      min_freight: number;
      min_freight_cargo_limit: number;
      min_tso: number;
      gris_percent: number;
      gris_min: number;
      gris_min_cargo_limit: number;
      dispatch_fee: number;
      cubage_factor: number;
    };

    let ltlParams: LtlParams | null = null;
    let dispatchFee = 0; // Taxa de Despacho (só fracionado)

    if (modality === 'fracionado') {
      const { data: ltlRow } = await supabase
        .from('ltl_parameters')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ltlRow) {
        // VEC-122: ?? preserva zeros intencionais (ex: dispatch_fee=0 para isenção de taxa)
        ltlParams = {
          min_freight: Number(ltlRow.min_freight ?? 9.28),
          min_freight_cargo_limit: Number(ltlRow.min_freight_cargo_limit ?? 3093.81),
          min_tso: Number(ltlRow.min_tso ?? 4.64),
          gris_percent: Number(ltlRow.gris_percent ?? 0.3),
          gris_min: Number(ltlRow.gris_min ?? 9.28),
          gris_min_cargo_limit: Number(ltlRow.gris_min_cargo_limit ?? 3093.81),
          dispatch_fee: Number(ltlRow.dispatch_fee ?? 102.9),
          cubage_factor: Number(ltlRow.cubage_factor ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3),
        };
      } else {
        // Fallback NTC Dez/25
        ltlParams = {
          min_freight: 9.28,
          min_freight_cargo_limit: 3093.81,
          min_tso: 4.64,
          gris_percent: 0.3,
          gris_min: 9.28,
          gris_min_cargo_limit: 3093.81,
          dispatch_fee: 102.9,
          cubage_factor: FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3,
        };
        fallbacksApplied.push('ltl_parameters: usando fallback NTC Dez/25');
      }

      if (ltlParams.cubage_factor > 0) {
        cubageFactor = ltlParams.cubage_factor;
        cubageWeightKg = input.volume_m3 * cubageFactor;
        billableWeightKg = Math.max(input.weight_kg, cubageWeightKg);
      }
    }

    // =====================================================
    // LTL: Determina coluna de faixa de peso
    // =====================================================

    function getLtlWeightColumn(weightKg: number): string | null {
      if (weightKg <= 10) return 'weight_rate_10';
      if (weightKg <= 20) return 'weight_rate_20';
      if (weightKg <= 30) return 'weight_rate_30';
      if (weightKg <= 50) return 'weight_rate_50';
      if (weightKg <= 70) return 'weight_rate_70';
      if (weightKg <= 100) return 'weight_rate_100';
      if (weightKg <= 150) return 'weight_rate_150';
      if (weightKg <= 200) return 'weight_rate_200';
      return null; // acima de 200 kg → usa weight_rate_above_200 * kg
    }

    // =====================================================
    // GET PRICE TABLE ROW
    // =====================================================

    if (!input.price_table_id) {
      responseStatus = 'MISSING_DATA';
      responseError = 'Tabela de preços não selecionada';
      fallbacksApplied.push('price_table: não informada');
    } else if (input.km_distance === undefined) {
      responseStatus = 'MISSING_DATA';
      responseError = 'Tabela de preços não selecionada';
      fallbacksApplied.push('price_table: km_distance ausente');
    } else {
      const kmBand = Math.ceil(Number(input.km_distance));
      kmBandUsed = kmBand;

      const { data: allRows, error: rowsError } = await supabase
        .from('price_table_rows')
        .select('*')
        .eq('price_table_id', input.price_table_id)
        .order('km_from', { ascending: true });

      if (rowsError) {
        kmStatus = 'OUT_OF_RANGE';
        responseStatus = 'MISSING_DATA';
        responseError = 'Erro ao consultar linhas da tabela de preços';
        fallbacksApplied.push(`price_table_row: ${rowsError.message}`);
      } else {
        const priceRow =
          allRows?.find(
            (r: { km_from: number; km_to: number }) => r.km_from <= kmBand && r.km_to >= kmBand
          ) ?? null;

        if (priceRow) {
          kmBandLabel = `${priceRow.km_from}-${priceRow.km_to}`;
          priceTableRowId = priceRow.id;

          if (modality === 'fracionado') {
            // =====================================================
            // NTC FRACIONADO (LTL) Dez/25 — R$/kg × peso em todas as faixas
            // =====================================================
            const weightCol = getLtlWeightColumn(billableWeightKg);

            if (weightCol) {
              // ≤ 200 kg: peso × R$/kg da faixa (proporcional)
              const ratePerKg = Number(priceRow[weightCol]) || 0;
              baseCost = billableWeightKg * ratePerKg;
              console.log(
                `[calculate-freight] NTC Fracionado | Faixa: ${kmBandLabel}, col: ${weightCol}, rate: ${ratePerKg}/kg, frete: R$ ${baseCost}`
              );
            } else {
              // > 200 kg: peso × R$/kg
              const ratePerKg = Number(priceRow.weight_rate_above_200) || 0;
              baseCost = billableWeightKg * ratePerKg;
              console.log(
                `[calculate-freight] NTC Fracionado | Faixa: ${kmBandLabel}, >200kg, rate: ${ratePerKg}/kg, frete: R$ ${baseCost}`
              );
            }

            // Fracionado: linha da tabela > ltl_parameters (somente GRIS) > Central > default
            const ruleGris = resolveRulePercent('gris_percent');
            const ruleTso = resolveRulePercent('tso_percent');
            const ruleCostVal = resolveRulePercent('cost_value_percent');
            const ptGris = toFiniteNumber(priceRow.gris_percent);
            const ptTso = toFiniteNumber(priceRow.tso_percent);
            const ptCostVal = toFiniteNumber(priceRow.cost_value_percent);
            const ltlGris = toFiniteNumber(ltlParams?.gris_percent);
            // Precedencia: Central > linha km > ltl_parameters (somente GRIS) > default
            grisPercent = ruleGris ?? ptGris ?? ltlGris ?? 0.3;
            tsoPercent = ruleTso ?? ptTso ?? 0.15;
            costValuePercent = ruleCostVal ?? ptCostVal ?? 0.3;
            dispatchFee = ltlParams?.dispatch_fee ?? 102.9;
          } else {
            // =====================================================
            // NTC LOTAÇÃO (FTL) — Ad Valorem substitui GRIS/TSO
            // =====================================================
            const costPerTon = Number(priceRow.cost_per_ton) || 0;
            baseCost = (billableWeightKg / 1000) * costPerTon;

            // Lotação: GRIS e TSO são zerados; Ad Valorem cobre custo de risco
            grisPercent = 0;
            tsoPercent = 0;

            const ruleCostVal = resolveRulePercent('cost_value_percent');
            const ptCostVal = toFiniteNumber(priceRow.cost_value_percent);
            // Lotação: Central > tabela quando Central > 0. Valor 0 na Central é tratado
            // como "não configurado" (cai na tabela) — evita zeragem acidental igual ao
            // incidente abr/2026, item B de docs/NTC_DIVERGENCIAS_LOTACAO.md.
            const effectiveRuleCostVal =
              ruleCostVal != null && ruleCostVal > 0 ? ruleCostVal : undefined;
            costValuePercent = effectiveRuleCostVal ?? ptCostVal ?? 0.3;

            console.log(
              `[calculate-freight] Lotação Ad Valorem | Faixa: ${kmBandLabel}, cost_per_ton: ${costPerTon}, frete_peso: ${baseCost}, adValoremPercent: ${adValoremLotacaoPercent}%, costValuePercent: ${costValuePercent}%`
            );
          }
        } else {
          kmStatus = 'OUT_OF_RANGE';
          responseStatus = 'OUT_OF_RANGE';
          responseError = `Não existe faixa para ${kmBandUsed} km nessa tabela`;
          fallbacksApplied.push(`price_table_row: nenhuma faixa para ${kmBandUsed} km`);
          grisPercent = resolveRulePercent('gris_percent') ?? 0.3;
          tsoPercent = resolveRulePercent('tso_percent') ?? 0.15;
          costValuePercent = resolveRulePercent('cost_value_percent') ?? 0.3;
        }
      }
    }

    // =====================================================
    // COMPONENTES — Frete Peso, GRIS, TSO, Frete Valor, Despacho
    // =====================================================

    let frete_peso = baseCost;
    const frete_peso_tabela = baseCost;
    let gris = input.cargo_value * (grisPercent / 100);
    let tso = input.cargo_value * (tsoPercent / 100);
    const frete_valor = input.cargo_value * (costValuePercent / 100);
    // Lotação: Ad Valorem calculado sobre valor NF; Fracionado: sempre 0
    const adValorem =
      modality === 'lotacao'
        ? roundCurrency(input.cargo_value * (adValoremLotacaoPercent / 100))
        : 0;

    // Fracionado: aplicar mínimos NTC
    if (modality === 'fracionado' && ltlParams) {
      // GRIS mínimo: se cargo_value ≤ limite, aplicar mínimo por CTe
      if (input.cargo_value <= ltlParams.gris_min_cargo_limit && gris < ltlParams.gris_min) {
        gris = ltlParams.gris_min;
        fallbacksApplied.push(`gris: mínimo NTC R$ ${ltlParams.gris_min}/CTe aplicado`);
      }
      // TSO mínimo por CTe
      if (tso < ltlParams.min_tso) {
        tso = ltlParams.min_tso;
        fallbacksApplied.push(`tso: mínimo NTC R$ ${ltlParams.min_tso}/CTe aplicado`);
      }
    }

    // =====================================================
    // TOLL VALUE (manual)
    // =====================================================

    const toll = input.toll_value ?? 0;

    // =====================================================
    // NTC FEES (TDE/TEAR) — TODO: generalidades NTC depois; por ora 0
    // =====================================================

    const tde = 0;
    const tear = 0;

    const axesCount =
      vehicleTypeAxesCountForRules ??
      toFiniteNumber((input as { vehicle_axes_count?: number }).vehicle_axes_count) ??
      null;

    // =====================================================
    // PISO ANTT (CARRETEIRO) — antes do frete peso golden (lotação)
    // =====================================================

    let pisoAnttCarreteiro = 0;
    let anttFloorRateId: string | undefined;
    let lotacaoFreteMeta: ReturnType<typeof resolveLotacaoFretePeso> | null = null;
    let anttMetaForResponse:
      | {
          operation_table: ReturnType<typeof resolveAnttOperationTable>;
          cargo_type: string;
          axes_count: number;
          km_distance: number;
          ccd: number;
          cc: number;
          ida: number;
          retorno_vazio: number;
          total: number;
          composicao_veicular: boolean;
          alto_desempenho: boolean;
        }
      | undefined;

    if (axesCount != null && axesCount > 0 && input.km_distance != null && input.km_distance > 0) {
      const anttFlags = {
        composicaoVeicular:
          input.antt_composicao_veicular ?? ANTT_FLOOR_DEFAULT_FLAGS.composicaoVeicular,
        altoDesempenho: input.antt_alto_desempenho ?? ANTT_FLOOR_DEFAULT_FLAGS.altoDesempenho,
        retornoVazio: input.antt_retorno_vazio ?? ANTT_FLOOR_DEFAULT_FLAGS.retornoVazio,
      };
      const operationTable = resolveAnttOperationTable(anttFlags);
      const anttCargoType = resolveAnttCargoTypeForPiso({
        anttCargoType: input.antt_cargo_type,
        cargoTypeLabel: input.cargo_type,
      });

      const { data: anttRate } = await supabase
        .from('antt_floor_rates')
        .select('id, ccd, cc, cargo_type')
        .eq('operation_table', operationTable)
        .eq('cargo_type', anttCargoType)
        .eq('axes_count', axesCount)
        .order('valid_from', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (anttRate?.ccd != null && anttRate?.cc != null) {
        const pisoCalc = computeAnttPisoCarreteiroReais({
          kmDistance: Number(input.km_distance),
          ccd: Number(anttRate.ccd),
          cc: Number(anttRate.cc),
          retornoVazio: anttFlags.retornoVazio,
          round: roundCurrency,
        });
        pisoAnttCarreteiro = pisoCalc.total;
        anttFloorRateId = (anttRate as { id?: string }).id ?? undefined;
        anttMetaForResponse = {
          operation_table: operationTable,
          cargo_type: anttCargoType,
          axes_count: axesCount,
          km_distance: Number(input.km_distance),
          ccd: Number(anttRate.ccd),
          cc: Number(anttRate.cc),
          ida: pisoCalc.ida,
          retorno_vazio: pisoCalc.retornoVazio,
          total: pisoCalc.total,
          composicao_veicular: anttFlags.composicaoVeicular,
          alto_desempenho: anttFlags.altoDesempenho,
        };
      }
    }

    if (modality === 'lotacao') {
      const overKmPercent = resolveLotacaoKmOverPercent(Number(input.km_distance ?? 0), (key) =>
        resolveRule(key, vehicleTypeIdForRules)
      );
      const overAnttPercent = resolveRule(LOTACAO_OVER_ANTT_KEY, vehicleTypeIdForRules) ?? 0;
      lotacaoFreteMeta = resolveLotacaoFretePeso({
        freteTabela: frete_peso_tabela,
        pisoAntt: pisoAnttCarreteiro,
        km: Number(input.km_distance ?? 0),
        overKmPercent,
        overAnttPercent,
        round: roundCurrency,
      });
      frete_peso = pisoAnttCarreteiro > 0 ? pisoAnttCarreteiro : lotacaoFreteMeta.fretePeso;
      if (lotacaoFreteMeta.anttCostBaseUsed) {
        fallbacksApplied.push(
          `lotacao: base custo motorista = piso ANTT calculadora (ceil(km)×CCD+CC = R$ ${pisoAnttCarreteiro})`
        );
        if (lotacaoFreteMeta.freteTabelaComOverKm > lotacaoFreteMeta.pisoAntt + 0.01) {
          fallbacksApplied.push(
            `lotacao: tabela NTC + ${lotacaoFreteMeta.overKmPercent}% km = R$ ${lotacaoFreteMeta.freteTabelaComOverKm} (referência, fora do gross-up)`
          );
        }
      } else if (lotacaoFreteMeta.overKmPercent > 0) {
        fallbacksApplied.push(
          `lotacao: base custo = tabela + ${lotacaoFreteMeta.overKmPercent}% km (R$ ${lotacaoFreteMeta.freteTabelaComOverKm}) — sem piso ANTT`
        );
      }
    }

    const ntc_base = frete_peso + frete_valor + gris + tso + dispatchFee;
    // ntc_base = pacote comercial NTC (peso + risco + despacho). NÃO é PAG/base motorista.
    // Base motorista fracionado = frete_peso (kg × R$/kg). Repasse de risco = receita Hub.

    // Base para taxas condicionais que aplicam sobre frete: mantém comportamento anterior
    // (correction + markup) para não alterar cobrança de fees já cadastrados
    const conditionalFeeFreightBase = frete_peso * correctionFactor * (1 + markupPercent / 100);

    // =====================================================
    // CONDITIONAL FEES
    // =====================================================

    const conditionalFeesBreakdown: Record<string, number> = {};
    let conditionalFeesTotal = 0;

    // FORBID_CONDITIONAL_FEES: quando a regra está ativa (valor=1), taxas condicionais do input são ignoradas.
    const forbidConditionalFees =
      (resolveRule('forbid_conditional_fees', vehicleTypeIdForRules) ?? 0) === 1;

    if (!forbidConditionalFees && input.conditional_fees && input.conditional_fees.length > 0) {
      const { data: fees } = await supabase
        .from('conditional_fees')
        .select('*')
        .in('code', input.conditional_fees)
        .eq('active', true);

      for (const feeCode of input.conditional_fees) {
        const fee = fees?.find((f) => f.code === feeCode);

        if (fee) {
          let feeValue = 0;
          const feeBase =
            fee.applies_to === 'cargo_value' ? input.cargo_value : conditionalFeeFreightBase;

          switch (fee.fee_type) {
            case 'percentage':
              feeValue = (feeBase * Number(fee.fee_value)) / 100;
              break;
            case 'fixed':
              feeValue = Number(fee.fee_value);
              break;
            case 'per_kg':
              feeValue = billableWeightKg * Number(fee.fee_value);
              break;
          }

          // Apply min/max (use != null to avoid falsy-zero bug)
          if (fee.min_value != null && feeValue < Number(fee.min_value))
            feeValue = Number(fee.min_value);
          if (fee.max_value != null && feeValue > Number(fee.max_value))
            feeValue = Number(fee.max_value);

          conditionalFeesBreakdown[feeCode] = roundCurrency(feeValue);
          conditionalFeesTotal += feeValue;
        } else {
          fallbacksApplied.push(`conditional_fee: "${feeCode}" não encontrada`);
        }
      }
    }

    // =====================================================
    // WAITING TIME
    // =====================================================

    let waitingTimeCost = 0;
    const vehicleTypeId = vehicleTypeIdForRules;

    if (input.waiting_hours !== undefined && input.waiting_hours > 0) {
      let waitingRule = null;

      if (vehicleTypeId) {
        const { data } = await supabase
          .from('waiting_time_rules')
          .select('*')
          .eq('vehicle_type_id', vehicleTypeId)
          .maybeSingle();
        waitingRule = data;
      }

      if (!waitingRule) {
        const { data } = await supabase
          .from('waiting_time_rules')
          .select('*')
          .is('vehicle_type_id', null)
          .maybeSingle();
        waitingRule = data;
      }

      if (waitingRule) {
        const rule = waitingRule as WaitingRuleRow;
        const freeHours = Number(rule.free_hours) || 5; // NTC 2.3: 5h franquia
        const excessHours = Math.max(0, input.waiting_hours - freeHours);

        if (excessHours > 0) {
          const ratePerHour = Number(rule.rate_per_hour) || 146.44; // NTC: Truck
          const ratePerDay = rule.rate_per_day != null ? Number(rule.rate_per_day) : null;

          // NTC: se excede 24h da franquia, cobrar diária inteira
          if (ratePerDay && excessHours >= 24) {
            const fullDays = Math.ceil(excessHours / 24);
            waitingTimeCost = fullDays * ratePerDay;
          } else {
            waitingTimeCost = excessHours * ratePerHour;
          }

          if (rule.min_charge != null && waitingTimeCost < Number(rule.min_charge)) {
            waitingTimeCost = Number(rule.min_charge);
          }
        }
      } else {
        // NTC fallback: 5h franquia, R$146.44/h (Caminhão Truck)
        const excessHours = Math.max(0, input.waiting_hours - 5);
        waitingTimeCost = excessHours * 146.44;
        fallbacksApplied.push('waiting_time_rules: usando fallback NTC 5h + R$146,44/h');
      }
    }

    // =====================================================
    // GET ICMS RATE
    // UF fiscal (sede CT-e) tem precedência sobre UF física da coleta.
    // fiscal_origin_uf é lido da Central de Regras (metadata.uf).
    // =====================================================

    const physicalOriginUf = extractUf(input.origin);
    const destUf = extractUf(input.destination);

    // Ler UF fiscal da Central de Regras (metadata.uf do registro fiscal_origin_uf)
    let fiscalOriginUf: string | null = null;
    const fiscalRule = allRules.find((r) => r.key === 'fiscal_origin_uf');
    if (fiscalRule) {
      // A UF fica no metadata (lido separadamente pois allRules só traz key/value/vehicle_type_id)
      const { data: fiscalRow } = await supabase
        .from('pricing_rules_config')
        .select('metadata')
        .eq('key', 'fiscal_origin_uf')
        .is('vehicle_type_id', null)
        .maybeSingle();
      fiscalOriginUf = ((fiscalRow?.metadata as Record<string, unknown>)?.uf as string) ?? null;
    }

    const originUf = fiscalOriginUf || physicalOriginUf;
    if (fiscalOriginUf && physicalOriginUf && fiscalOriginUf !== physicalOriginUf) {
      fallbacksApplied.push(
        `icms_origin: usando UF fiscal ${fiscalOriginUf} (sede CT-e) em vez de ${physicalOriginUf} (coleta física)`
      );
    }

    let icmsPercent: number = FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT;

    const resolveIcmsFromRules = (): number | undefined => {
      const ruleValue = resolveRule('icms_default', vehicleTypeIdForRules) as number | undefined;
      return ruleValue !== undefined ? normalizeIcmsRate(ruleValue) : undefined;
    };

    if (originUf && destUf) {
      const { data: icmsRow } = await supabase
        .from('icms_rates')
        .select('rate_percent')
        .eq('origin_state', originUf)
        .eq('destination_state', destUf)
        .maybeSingle();

      if (icmsRow?.rate_percent !== undefined) {
        // VEC-125: icms_rates armazena alíquotas já no formato correto (ex: 12, 7)
        icmsPercent = Number(icmsRow.rate_percent);
      } else {
        const icmsFromRules = resolveIcmsFromRules();
        if (icmsFromRules !== undefined) {
          icmsPercent = icmsFromRules;
          fallbacksApplied.push(
            `icms_rates: ${originUf}→${destUf} não encontrada, usando icms_default da Central de Regras`
          );
        } else {
          fallbacksApplied.push(
            `icms_rates: ${originUf}→${destUf} não encontrada, usando ${FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT}%`
          );
        }
      }
    } else {
      const icmsFromRules = resolveIcmsFromRules();
      if (icmsFromRules !== undefined) {
        icmsPercent = icmsFromRules;
        fallbacksApplied.push('icms_default: origem/destino não informados, usando regra global');
      }
    }

    // Validate ICMS rate to prevent invalid calculations
    if (icmsPercent >= 100) {
      fallbacksApplied.push(
        `icms_percent ${icmsPercent}% inválida (>= 100%), usando ${FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT}%`
      );
      icmsPercent = FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT;
    }

    // Simples Nacional: ICMS não incide no cálculo (linha continua visível com 0% e R$ 0,00)
    // Lucro Presumido: ICMS incide normalmente (tabela icms_rates)
    if (isSimples && !regimeLucroPresumido) icmsPercent = 0;

    // =====================================================
    // GET TAC RATE — NTC 2.6: Temporal formula
    // Para cada 5% de variação do diesel → 1,75% sobre frete peso
    // Base: frete base (EXCLUI pedágio, GRIS, etc.)
    // =====================================================

    let tacPercent = 0;
    let dieselVariationPercent = 0;
    let tacSteps = 0;
    const today = new Date().toISOString().split('T')[0];

    const { data: tacRate } = await supabase
      .from('tac_rates')
      .select('variation_percent')
      .lte('reference_date', today)
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tacRate?.variation_percent != null) {
      dieselVariationPercent = Number(tacRate.variation_percent);
      if (dieselVariationPercent >= 5) {
        tacSteps = Math.floor(dieselVariationPercent / 5);
        tacPercent = tacSteps * 1.75;
      }
    }

    // =====================================================
    // GET PAYMENT TERM ADJUSTMENT (optional)
    // =====================================================

    let paymentAdjustmentPercent = 0;
    const paymentTermCode = input.payment_term_code ?? 'D30';

    const { data: paymentTerm } = await supabase
      .from('payment_terms')
      .select('code, adjustment_percent')
      .eq('code', paymentTermCode)
      .eq('active', true)
      .maybeSingle();

    if (paymentTerm) {
      paymentAdjustmentPercent = Number(paymentTerm.adjustment_percent);
    }

    // =====================================================
    // TAC & PAYMENT ADJUSTMENTS (NTC 2.6 + prazo)
    // =====================================================

    const tacAdjustment = frete_peso * (tacPercent / 100);
    const receitaBrutaPreTac =
      frete_peso +
      toll +
      gris +
      tso +
      frete_valor +
      adValorem +
      tde +
      tear +
      dispatchFee +
      conditionalFeesTotal +
      waitingTimeCost +
      aluguelMaquinasValue;
    const receitaComTac = receitaBrutaPreTac + tacAdjustment;
    const paymentAdjustment = receitaComTac * (paymentAdjustmentPercent / 100);

    // =====================================================
    // GROSS-UP HÍBRIDO (Asset-Light)
    // Simples: divisor = 1 - (Overhead + DAS + Lucro)/100, ICMS=0
    // Sublimite: divisor = 1 - (Overhead + DAS + ICMS + Lucro)/100
    // Alinhado com freightCalculator client-side.
    // =====================================================

    const anttFloorApplied =
      modality === 'lotacao' &&
      (lotacaoFreteMeta?.anttCostBaseUsed ??
        lotacaoFreteMeta?.anttFloorApplied ??
        (pisoAnttCarreteiro > 0 && pisoAnttCarreteiro > frete_peso_tabela));
    const enforceAnttFloor = !!(input as { enforce_antt_floor?: boolean }).enforce_antt_floor;
    const anttFloorForced =
      enforceAnttFloor && anttFloorApplied && pisoAnttCarreteiro > frete_peso_tabela;
    const fretePesoForGrossUp = frete_peso;
    const custoMotoristaAntt = lotacaoFreteMeta?.pisoAntt ?? pisoAnttCarreteiro;
    console.log(
      `[calculate-freight] Lotação frete: tabela=${frete_peso_tabela}, piso=${pisoAnttCarreteiro}, golden=${frete_peso}, pisoAplicado=${lotacaoFreteMeta?.pisoAplicado ?? false}`
    );
    const repasseRisco = roundCurrency(gris + tso + frete_valor + adValorem);
    // DRE v5 (Asset-Light): Taxa de Despacho (dispatchFee) eh repasse/cobranca
    // do embarcador, NAO custo direto. Mantida apenas em receitaBrutaPreTac;
    // removida do custoServicosOperacionais pra nao inflar custosDiretos
    // (e portanto o "lucro alvo" calculado por custosDiretos x targetPercent).
    // CD: motorista + pedágio/NTC + espera + aluguel + descarga (repasse real).
    // Taxas condicionais = markup (receita) — fora do divisor c/ risco.
    const custoServicosOperacionais = roundCurrency(
      toll + tde + tear + waitingTimeCost + aluguelMaquinasValue + tacAdjustment + paymentAdjustment
    );
    const custoServicos = custoServicosOperacionais;
    const custoMotoristaContratado = fretePesoForGrossUp;
    const custosDescarga = descargaValue;
    const custosDiretos = custoMotoristaContratado + custoServicosOperacionais + custosDescarga;
    const receitaForaDivisor = roundCurrency(repasseRisco + conditionalFeesTotal);
    const riskCostsEstimate = estimateInsuranceRiskCosts(
      Number(input.cargo_value ?? 0),
      roundCurrency
    );
    const custosRiscoReal = riskCostsEstimate.total;

    let regimeFiscal: 'simples_nacional' | 'excesso_sublimite' | 'lucro_presumido' | 'normal';
    let icmsNoDivisor: boolean;
    if (regimeLucroPresumido) {
      regimeFiscal = 'lucro_presumido';
      icmsNoDivisor = true;
    } else if (regimeSimplesNacional && !excessoSublimite) {
      regimeFiscal = 'simples_nacional';
      icmsNoDivisor = false;
    } else if (regimeSimplesNacional && excessoSublimite) {
      regimeFiscal = 'excesso_sublimite';
      icmsNoDivisor = true;
    } else {
      regimeFiscal = 'normal';
      icmsNoDivisor = true;
    }

    // LP: impostos individuais no divisor (PIS+COFINS+IRPJ+CSLL+ICMS)
    // Simples: DAS no divisor, ICMS=0
    // Sublimite/Normal: DAS+ICMS no divisor
    let taxaBruta: number;
    if (regimeFiscal === 'lucro_presumido') {
      taxaBruta =
        (overheadPercent +
          pisPercent +
          cofinsPercent +
          irpjEffectivePercent +
          csllEffectivePercent +
          icmsPercent +
          profitMarginPercent) /
        100;
    } else if (icmsNoDivisor) {
      taxaBruta = (overheadPercent + dasPercent + icmsPercent + profitMarginPercent) / 100;
    } else {
      taxaBruta = (overheadPercent + dasPercent + profitMarginPercent) / 100;
    }

    let totalCliente: number;
    let das: number;
    let icms: number;
    let pis = 0;
    let cofins = 0;
    let irpj = 0;
    let csll = 0;

    if (taxaBruta >= 1) {
      fallbacksApplied.push(
        `gross_up: soma impostos+overhead+lucro >= 100%, usando modelo por fora`
      );
      const receitaFinal = receitaBrutaPreTac + tacAdjustment + paymentAdjustment;
      if (regimeFiscal === 'lucro_presumido') {
        das = 0;
        pis = roundCurrency(receitaFinal * (pisPercent / 100));
        cofins = roundCurrency(receitaFinal * (cofinsPercent / 100));
        irpj = roundCurrency(receitaFinal * (irpjEffectivePercent / 100));
        csll = roundCurrency(receitaFinal * (csllEffectivePercent / 100));
        icms = roundCurrency(receitaFinal * (icmsPercent / 100));
      } else {
        const dasProvisionMinValue =
          resolveRule('das_provision_min_value', vehicleTypeIdForRules) ?? 0;
        das = roundCurrency(Math.max(receitaFinal * (dasPercent / 100), dasProvisionMinValue));
        icms = roundCurrency(receitaFinal * (icmsPercent / 100));
      }
      totalCliente = roundCurrency(receitaFinal + das + icms + pis + cofins + irpj + csll);
    } else {
      const totalClienteCore = roundCurrency(custosDiretos / (1 - taxaBruta));
      let taxaImpostos = 0;
      if (regimeFiscal === 'lucro_presumido') {
        taxaImpostos =
          (pisPercent + cofinsPercent + irpjEffectivePercent + csllEffectivePercent + icmsPercent) /
          100;
      } else if (icmsNoDivisor) {
        taxaImpostos = (dasPercent + icmsPercent) / 100;
      } else {
        taxaImpostos = dasPercent / 100;
      }
      const receitaForaComImpostos =
        receitaForaDivisor > 0 && taxaImpostos < 1
          ? receitaForaDivisor / (1 - taxaImpostos)
          : receitaForaDivisor;
      totalCliente = roundCurrency(totalClienteCore + receitaForaComImpostos);
      if (regimeFiscal === 'lucro_presumido') {
        das = 0;
        pis = roundCurrency(totalCliente * (pisPercent / 100));
        cofins = roundCurrency(totalCliente * (cofinsPercent / 100));
        irpj = roundCurrency(totalCliente * (irpjEffectivePercent / 100));
        csll = roundCurrency(totalCliente * (csllEffectivePercent / 100));
        icms = roundCurrency(totalCliente * (icmsPercent / 100));
      } else {
        das = roundCurrency(totalCliente * (dasPercent / 100));
        icms =
          regimeFiscal === 'simples_nacional'
            ? 0
            : roundCurrency(totalCliente * (icmsPercent / 100));
      }
    }

    const totalImpostos = das + icms + pis + cofins + irpj + csll;
    const receitaLiquida = roundCurrency(totalCliente - totalImpostos);
    const overhead = roundCurrency(receitaLiquida * (overheadPercent / 100));

    let margemBruta: number;
    let resultadoLiquido: number;
    let lucroAlvo: number;
    let margemPercent: number;

    if (modality === 'lotacao') {
      const lotacaoProfit = calculateLotacaoProfitability(
        {
          receitaLiquida,
          overhead,
          fretePeso: frete_peso,
          pisoAntt: pisoAnttCarreteiro,
          custoServicos: custoServicosOperacionais,
          custosDescarga,
          custosDiretos,
          totalCliente,
          profitMarginPercent,
          custosRiscoReal,
        },
        roundCurrency
      );
      margemBruta = lotacaoProfit.margemBruta;
      resultadoLiquido = lotacaoProfit.resultadoLiquido;
      lucroAlvo = lotacaoProfit.lucroAlvo;
      margemPercent = lotacaoProfit.margemPercent;
    } else {
      margemBruta = roundCurrency(
        receitaLiquida - overhead - custoMotoristaAntt - custoServicosOperacionais - custosDescarga
      );
      resultadoLiquido = roundCurrency(margemBruta - custosRiscoReal);
      lucroAlvo =
        custosDiretos > 0 && profitMarginPercent > 0
          ? roundCurrency(custosDiretos * (profitMarginPercent / 100))
          : resultadoLiquido;
      margemPercent = totalCliente > 0 ? roundCurrency((resultadoLiquido / totalCliente) * 100) : 0;
    }

    // =====================================================
    // BUILD RESPONSE
    // =====================================================

    const routeUfLabel = formatRouteUf(input.origin, input.destination);
    const marginStatus = getMarginStatus(margemPercent, profitMarginPercent);

    // =====================================================
    // TRIPLO MATCH (BENCHMARK)
    // =====================================================
    let ckanBenchmarkGross: number | undefined;

    if (input.benchmarks?.ckanBenchmark) {
      const repasseRisco = sumRiskRepasse({ gris, tso, rctrc, adValorem });
      const ckanCustosDiretos = roundCurrency(
        input.benchmarks.ckanBenchmark + custoServicosOperacionais + descargaValue
      );

      const ckanGrossUp = calculateGrossUpHibrido(
        ckanCustosDiretos,
        overheadPercent,
        profitMarginPercent,
        regimeSimplesNacional,
        dasPercent,
        icmsPercent,
        pisPercent,
        cofinsPercent,
        irpjEffectivePercent,
        csllEffectivePercent,
        receitaForaDivisor
      );
      ckanBenchmarkGross = ckanGrossUp.totalCliente;
    }

    let matchStatus:
      | {
          status: 'WIN' | 'LOSS' | 'WARNING';
          ckanBenchmarkLiquido?: number;
          ckanGrossValue?: number;
        }
      | undefined;

    if (ckanBenchmarkGross != null && ckanBenchmarkGross > 0) {
      const ckanLiquido = input.benchmarks?.ckanBenchmark;
      const targetTeto = ckanBenchmarkGross * 1.05;
      matchStatus = {
        status: totalCliente <= targetTeto ? 'WIN' : 'LOSS',
        ckanBenchmarkLiquido: ckanLiquido,
        ckanGrossValue: ckanBenchmarkGross,
      };
    }

    const meta: FreightMeta = {
      route_uf_label: routeUfLabel,
      km_band_label: kmBandLabel,
      km_status: kmStatus,
      margin_status: marginStatus,
      margin_percent: roundCurrency(margemPercent),
      ...(matchStatus && { match_status: matchStatus }),
      cubage_factor: cubageFactor,
      cubage_weight_kg: roundCurrency(cubageWeightKg),
      billable_weight_kg: roundCurrency(billableWeightKg),
      ...(kmBandUsed !== undefined && { km_band_used: kmBandUsed }),
      ...(priceTableRowId && { price_table_row_id: priceTableRowId }),
      ...(priceTableRowId && { ntc_base: roundCurrency(ntc_base) }),
      antt_piso_carreteiro: roundCurrency(pisoAnttCarreteiro),
      antt_floor_applied: anttFloorApplied,
      ...(modality === 'lotacao' &&
        lotacaoFreteMeta &&
        lotacaoFreteMeta.anttCostBaseUsed &&
        lotacaoFreteMeta.freteTabelaComOverKm > lotacaoFreteMeta.pisoAntt + 0.01 && {
          frete_peso_original: roundCurrency(lotacaoFreteMeta.freteTabelaComOverKm),
        }),
      ...(lotacaoFreteMeta && {
        lotacao_over_km_percent: lotacaoFreteMeta.overKmPercent,
        lotacao_over_antt_percent: lotacaoFreteMeta.overAnttPercent,
        lotacao_piso_com_over: roundCurrency(pisoAnttCarreteiro || lotacaoFreteMeta.pisoAntt),
        lotacao_frete_tabela_com_over_km: roundCurrency(lotacaoFreteMeta.freteTabelaComOverKm),
        lotacao_frete_referencia_max: roundCurrency(lotacaoFreteMeta.fretePesoReferenciaMax),
        antt_cost_base_used: lotacaoFreteMeta.anttCostBaseUsed,
      }),
      ...(anttFloorRateId && { antt_floor_rate_id: anttFloorRateId }),
      antt_calculated_at: new Date().toISOString(),
      ...(anttMetaForResponse && { antt: anttMetaForResponse }),
      ...(anttFloorForced && { antt_floor_forced: true }),
      original_weight_kg: roundCurrency(originalWeightKg),
    };

    const components: FreightComponents = {
      base_cost: roundCurrency(custoMotoristaContratado),
      base_freight: roundCurrency(custoMotoristaContratado),
      toll: roundCurrency(toll),
      gris: roundCurrency(gris),
      tso: roundCurrency(tso),
      rctrc: roundCurrency(frete_valor),
      ad_valorem: roundCurrency(adValorem),
      tde: roundCurrency(tde),
      tear: roundCurrency(tear),
      dispatch_fee: roundCurrency(dispatchFee),
      conditional_fees_total: roundCurrency(conditionalFeesTotal),
      waiting_time_cost: roundCurrency(waitingTimeCost),
      das_provision: roundCurrency(das),
      aluguel_maquinas: roundCurrency(aluguelMaquinasValue),
    };

    const rates: FreightRates = {
      das_percent: dasPercent,
      icms_percent: icmsPercent,
      pis_percent: pisPercent,
      cofins_percent: cofinsPercent,
      irpj_percent: irpjEffectivePercent,
      csll_percent: csllEffectivePercent,
      gris_percent: grisPercent,
      tso_percent: tsoPercent,
      cost_value_percent: costValuePercent,
      ad_valorem_percent: modality === 'lotacao' ? adValoremLotacaoPercent : undefined,
      markup_percent: markupPercent,
      overhead_percent: overheadPercent,
      tac_percent: tacPercent,
      payment_adjustment_percent: paymentAdjustmentPercent,
    };

    const totals: FreightTotals = {
      receita_bruta: roundCurrency(totalCliente),
      das,
      icms: roundCurrency(icms),
      pis: roundCurrency(pis),
      cofins: roundCurrency(cofins),
      irpj: roundCurrency(irpj),
      csll: roundCurrency(csll),
      tac_adjustment: roundCurrency(tacAdjustment),
      payment_adjustment: roundCurrency(paymentAdjustment),
      total_impostos: roundCurrency(totalImpostos),
      total_cliente: roundCurrency(totalCliente),
    };

    const custoMotoristaAnttKpi = roundCurrency(lotacaoFreteMeta?.pisoAntt ?? pisoAnttCarreteiro);
    const custoMotoristaPag =
      modality === 'fracionado' ? roundCurrency(custoMotoristaContratado) : custoMotoristaAnttKpi;

    const profitability: FreightProfitability = {
      // Campos legados — mantidos para compatibilidade durante migração (VEC-121)
      custos_carreteiro: roundCurrency(custoMotoristaContratado),
      // Fracionado: PAG = frete peso NTC. Lotação: KPI de piso ANTT.
      custo_motorista: custoMotoristaPag,
      // Novos campos semânticos (VEC-121)
      custo_motorista_contratado: roundCurrency(custoMotoristaContratado),
      custo_motorista_antt: custoMotoristaAnttKpi,
      custo_motorista_real: null, // a ser alimentado via OS após negociação
      custos_servicos: roundCurrency(custoServicos),
      custos_descarga: roundCurrency(custosDescarga),
      custos_diretos: roundCurrency(custosDiretos),
      receita_liquida: receitaLiquida,
      margem_bruta: margemBruta,
      overhead,
      resultado_liquido: resultadoLiquido,
      lucro_alvo: lucroAlvo,
      margem_percent: margemPercent,
      profit_margin_target: profitMarginPercent,
      regime_fiscal: regimeFiscal,
    };

    const response: CalculateFreightResponse = {
      success: true,
      status: responseStatus,
      error: responseError,
      meta,
      components,
      rates,
      totals,
      profitability,
      conditional_fees_breakdown: conditionalFeesBreakdown,
      fallbacks_applied: fallbacksApplied,
      errors: [],
      // v5: risk pass-through (cobrado do cliente, repassado à seguradora/GR)
      risk_pass_through: {
        gris: components.gris,
        tso: components.tso,
        rctrc: components.rctrc,
        ad_valorem: components.ad_valorem,
        total: roundCurrency(
          components.gris + components.tso + components.rctrc + components.ad_valorem
        ),
      },
      risk_costs:
        riskCostsEstimate.total > 0
          ? {
              items: riskCostsEstimate.items,
              total: riskCostsEstimate.total,
            }
          : undefined,
    };

    console.log('[calculate-freight] Complete:', {
      total: totalCliente,
      margin: margemPercent.toFixed(2) + '%',
      status: response.status,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[calculate-freight] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        success: false,
        status: 'MISSING_DATA',
        errors: [`Erro interno: ${errorMessage}`],
        meta: null,
        components: null,
        rates: null,
        totals: null,
        profitability: null,
        conditional_fees_breakdown: {},
        fallbacks_applied: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
