import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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

type FairTenantContextValue = {
  tenant: FairTenant | null;
  companies: FairTenant[];
  isLoading: boolean;
  canSwitchTenant: boolean;
  setTenantSlug: (slug: string) => void;
};

const FairTenantContext = createContext<FairTenantContextValue | null>(null);

async function fetchFairCompanies(): Promise<FairTenant[]> {
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

export function FairTenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canSwitchTenant = canSwitchFairTenant(user?.email);

  const q = useQuery({
    queryKey: ['feira-companies'],
    enabled: !!user,
    queryFn: fetchFairCompanies,
    staleTime: 1000 * 60 * 10,
  });

  const companies = useMemo(() => q.data ?? [], [q.data]);

  const [staffSlug, setStaffSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!canSwitchTenant) {
      setStaffSlug(null);
      return;
    }
    const stored = readFairStaffTenantSlug();
    if (stored && companies.some((c) => c.slug === stored)) {
      setStaffSlug(stored);
      return;
    }
    if (companies[0]?.slug) setStaffSlug(companies[0].slug);
  }, [canSwitchTenant, companies]);

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
      void queryClient.invalidateQueries({ queryKey: ['fair_product_catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['feira-playfit-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['playfit_catalog'] });
    },
    [companies, queryClient]
  );

  const value = useMemo(
    () => ({
      tenant,
      companies,
      isLoading: q.isLoading,
      canSwitchTenant,
      setTenantSlug,
    }),
    [tenant, companies, q.isLoading, canSwitchTenant, setTenantSlug]
  );

  return <FairTenantContext.Provider value={value}>{children}</FairTenantContext.Provider>;
}

export function useFairResolvedTenant(): FairTenantContextValue {
  const ctx = useContext(FairTenantContext);
  if (!ctx) {
    throw new Error('useFairResolvedTenant must be used within FairTenantProvider');
  }
  return ctx;
}
