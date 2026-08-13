import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { asDb, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import type {
  PricingParameter,
  WaitingTimeRule,
  TollRoute,
  TacRate,
  ConditionalFee,
  PaymentTerm,
} from '@/types/pricing';
import { isPriceTableMethodology, type PriceTableMethodology } from '@/lib/pricingMethodology';
import {
  resolvePricingRule as resolvePricingRuleCore,
  type ResolvePricingRuleScope,
} from '@/lib/resolvePricingRule';

export type { ResolvePricingRuleScope };
export { resolvePricingRuleCore as resolvePricingRule };

// =====================================================
// PRICING PARAMETERS
// =====================================================

export function usePricingParameters() {
  return useQuery({
    queryKey: ['pricing-parameters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_parameters').select('*').order('key');

      if (error) throw error;
      return filterSupabaseRows<PricingParameter>(data);
    },
  });
}

export function usePricingParameter(key: string) {
  return useQuery({
    queryKey: ['pricing-parameters', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_parameters')
        .select('*')
        .eq('key', asDb(key))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<PricingParameter>(data);
    },
    enabled: !!key,
  });
}

// =====================================================
// WAITING TIME RULES
// =====================================================

export function useWaitingTimeRules() {
  return useQuery({
    queryKey: ['waiting-time-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiting_time_rules')
        .select('*, vehicle_types(code, name)')
        .order('vehicle_type_id', { nullsFirst: true });

      if (error) throw error;
      return filterSupabaseRows<
        WaitingTimeRule & { vehicle_types: { code: string; name: string } | null }
      >(data);
    },
  });
}

// =====================================================
// TOLL ROUTES
// =====================================================

export function useTollRoutes() {
  return useQuery({
    queryKey: ['toll-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('toll_routes')
        .select('*, vehicle_types(code, name)')
        .order('origin_state')
        .order('destination_state');

      if (error) throw error;
      return filterSupabaseRows<
        TollRoute & { vehicle_types: { code: string; name: string } | null }
      >(data);
    },
  });
}

// =====================================================
// TAC RATES
// =====================================================

export function useTacRates() {
  return useQuery({
    queryKey: ['tac-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tac_rates')
        .select('*')
        .order('reference_date', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<TacRate>(data);
    },
  });
}

export function useLatestTacRate() {
  return useQuery({
    queryKey: ['tac-rates', 'latest'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('tac_rates')
        .select('*')
        .lte('reference_date', today)
        .order('reference_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<TacRate>(data);
    },
  });
}

// =====================================================
// CONDITIONAL FEES
// =====================================================

export function useConditionalFees(activeOnly = true) {
  return useQuery({
    queryKey: ['conditional-fees', { activeOnly }],
    queryFn: async () => {
      let query = supabase.from('conditional_fees').select('*').order('code');

      if (activeOnly) {
        query = query.eq('active', asDb(true));
      }

      const { data, error } = await query;
      if (error) throw error;
      return filterSupabaseRows<ConditionalFee>(data);
    },
  });
}

// =====================================================
// PRICING RULES CONFIG (Central de Regras)
// =====================================================

export interface PricingRuleConfig {
  id: string;
  key: string;
  label: string;
  category: string;
  value_type: string;
  value: number;
  min_value: number | null;
  max_value: number | null;
  vehicle_type_id: string | null;
  methodology: PriceTableMethodology;
  is_active: boolean;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export type PricingRulesCategory = 'aluguel' | 'carga_descarga';

function parseRuleNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseRuleNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = parseRuleNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePricingRule(row: Record<string, unknown>): PricingRuleConfig {
  const rawMetadata = row.metadata;
  const metadata =
    rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, unknown>)
      : {};
  const rawIsActive = row.is_active;
  const isActive =
    typeof rawIsActive === 'boolean'
      ? rawIsActive
      : rawIsActive === 1 || String(rawIsActive).toLowerCase() === 'true';

  return {
    id: String(row.id ?? ''),
    key: String(row.key ?? ''),
    label: String(row.label ?? row.key ?? ''),
    category: String(row.category ?? ''),
    value_type: String(row.value_type ?? 'fixed'),
    value: parseRuleNumber(row.value, 0),
    min_value: parseRuleNullableNumber(row.min_value),
    max_value: parseRuleNullableNumber(row.max_value),
    vehicle_type_id: row.vehicle_type_id ? String(row.vehicle_type_id) : null,
    methodology: isPriceTableMethodology(row.methodology) ? row.methodology : 'lotacao',
    is_active: isActive,
    metadata,
    updated_at: String(row.updated_at ?? ''),
  };
}

export function usePricingRulesConfig(activeOnly = true) {
  return useQuery({
    queryKey: ['pricing-rules-config', { activeOnly }],
    queryFn: async () => {
      let query = supabase.from(asDb('pricing_rules_config')).select('*');
      if (activeOnly) query = query.eq('is_active', asDb(true));
      const { data, error } = await query
        .order('category', { ascending: true })
        .order('label', { ascending: true })
        .order('key', { ascending: true });
      if (error) throw error;
      const rows = filterSupabaseRows<Record<string, unknown>>(data as unknown);
      return rows.map(normalizePricingRule);
    },
  });
}

export function usePricingRulesByCategory(category: PricingRulesCategory, activeOnly = true) {
  const query = usePricingRulesConfig(activeOnly);
  const filtered = useMemo(
    () =>
      (query.data ?? [])
        .filter((rule) => String(rule.category).trim().toLowerCase() === category)
        .sort(
          (a, b) =>
            String(a.label).localeCompare(String(b.label), 'pt-BR') ||
            String(a.key).localeCompare(String(b.key), 'pt-BR')
        ),
    [query.data, category]
  );

  return { ...query, data: filtered };
}

// =====================================================
// PAYMENT TERMS
// =====================================================

export function usePaymentTerms(activeOnly = true) {
  return useQuery({
    queryKey: ['payment-terms', { activeOnly }],
    queryFn: async () => {
      let query = supabase.from('payment_terms').select('*').order('days');

      if (activeOnly) {
        query = query.eq('active', asDb(true));
      }

      const { data, error } = await query;
      if (error) throw error;
      return filterSupabaseRows<PaymentTerm>(data);
    },
  });
}
