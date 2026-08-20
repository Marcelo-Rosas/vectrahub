import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  companyRowToTenant,
  resolveFairTenant,
  type FairCompanyRow,
  type FairTenant,
} from '@/lib/fair-tenant';

export function useFairCompanies(enabled = true) {
  return useQuery({
    queryKey: ['feira-companies'],
    enabled,
    queryFn: async (): Promise<FairTenant[]> => {
      const { data, error } = await supabase
        .schema('feira' as never)
        .from('companies')
        .select(
          'id, slug, name, origin_city, origin_uf, origin_label, origin_cep, email_domains, event_flag, toll_fallback_percent, active'
        )
        .eq('active', true)
        .order('slug');
      if (error) throw error;
      return ((data ?? []) as FairCompanyRow[]).map(companyRowToTenant);
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useFairResolvedTenant(): {
  tenant: FairTenant | null;
  companies: FairTenant[];
  isLoading: boolean;
} {
  const { user } = useAuth();
  const q = useFairCompanies(!!user);
  const companies = q.data ?? [];
  return {
    tenant: resolveFairTenant(user?.email, companies),
    companies,
    isLoading: q.isLoading,
  };
}
