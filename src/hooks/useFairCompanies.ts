import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  canSwitchFairTenant,
  companyRowToTenant,
  readFairStaffTenantSlug,
  resolveFairTenant,
  writeFairStaffTenantSlug,
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
  canSwitchTenant: boolean;
  setTenantSlug: (slug: string) => void;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const q = useFairCompanies(!!user);
  const companies = q.data ?? [];
  const canSwitchTenant = canSwitchFairTenant(user?.email);

  const [staffSlug, setStaffSlug] = useState<string | null>(() =>
    canSwitchFairTenant(user?.email) ? readFairStaffTenantSlug() : null
  );

  useEffect(() => {
    if (!canSwitchTenant) return;
    if (staffSlug && companies.some((c) => c.slug === staffSlug)) return;
    const stored = readFairStaffTenantSlug();
    if (stored && companies.some((c) => c.slug === stored)) {
      setStaffSlug(stored);
      return;
    }
    if (companies[0]?.slug) setStaffSlug(companies[0].slug);
  }, [canSwitchTenant, companies, staffSlug]);

  const tenant = useMemo(
    () => resolveFairTenant(user?.email, companies, staffSlug),
    [user?.email, companies, staffSlug]
  );

  const setTenantSlug = useCallback(
    (slug: string) => {
      const next = slug.trim().toLowerCase();
      if (!companies.some((c) => c.slug === next)) return;
      setStaffSlug(next);
      writeFairStaffTenantSlug(next);
      void queryClient.invalidateQueries({ queryKey: ['feira-brand'] });
      void queryClient.invalidateQueries({ queryKey: ['feira-product-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['feira-playfit-catalog'] });
    },
    [companies, queryClient]
  );

  return {
    tenant,
    companies,
    isLoading: q.isLoading,
    canSwitchTenant,
    setTenantSlug,
  };
}
