import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import type { PriceTableMethodology } from '@/lib/pricingMethodology';

export function useCreatePricingRuleConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      key: string;
      label: string;
      category: string;
      value_type: string;
      value: number;
      min_value?: number | null;
      max_value?: number | null;
      vehicle_type_id?: string | null;
      methodology: PriceTableMethodology;
      metadata?: Record<string, unknown>;
    }) => {
      const sb = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
      const { data: result, error } = await sb
        .from('pricing_rules_config')
        .insert(
          asInsert({
            ...data,
            min_value: data.min_value ?? null,
            max_value: data.max_value ?? null,
            vehicle_type_id: data.vehicle_type_id ?? null,
            metadata: data.metadata ?? {},
          })
        )
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules-config'] });
    },
  });
}

export function useUpdatePricingRuleConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const sb = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
      const { data, error } = await sb
        .from('pricing_rules_config')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules-config'] });
    },
  });
}

export function useDeletePricingRuleConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const sb = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
      const { error } = await sb.from('pricing_rules_config').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules-config'] });
    },
  });
}
