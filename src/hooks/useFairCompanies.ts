import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { companyRowToTenant, type FairCompanyRow, type FairTenant } from '@/lib/fair-tenant';

export { useFairResolvedTenant } from '@/contexts/FairTenantContext';

async function fetchFairCompaniesList(): Promise<FairTenant[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feira = (supabase as any).schema('feira');
  const rpc = await feira.rpc('list_companies_for_session');
  if (!rpc.error) {
    return ((rpc.data ?? []) as FairCompanyRow[]).map(companyRowToTenant);
  }
  const { data, error } = await feira
    .from('companies')
    .select(
      'id, slug, name, origin_city, origin_uf, origin_label, origin_cep, email_domains, event_flag, toll_fallback_percent, active'
    )
    .eq('active', true)
    .order('slug');
  if (error) throw error;
  return ((data ?? []) as FairCompanyRow[]).map(companyRowToTenant);
}

/** Lista embarcadores feira (ProtectedRoute, auth redirect). */
export function useFairCompanies(enabled = true) {
  return useQuery({
    queryKey: ['feira-companies'],
    enabled,
    queryFn: fetchFairCompaniesList,
    staleTime: 1000 * 60 * 10,
  });
}
