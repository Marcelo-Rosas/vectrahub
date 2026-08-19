import { BrandLogo } from '@/components/BrandLogo';
import { FairTenantLogo } from '@/components/fair/FairTenantLogo';
import type { FairTenant } from '@/lib/fair-tenant';
import { cn } from '@/lib/utils';

type FairBrandLockupSize = 'auth' | 'header';

/** Lockup /auth feira — logo do embarcador quando metadado resolvido. */
export function FairBrandLockup({
  tenant,
  size = 'header',
  className,
}: {
  tenant?: FairTenant | null;
  size?: FairBrandLockupSize;
  tone?: 'light' | 'dark';
  withText?: boolean;
  className?: string;
}) {
  if (!tenant) {
    return <BrandLogo size="lg" className={className} />;
  }
  return (
    <FairTenantLogo
      tenant={tenant}
      size={size === 'auth' ? 'auth' : 'lg'}
      className={cn(size === 'auth' && 'shadow-sm', className)}
    />
  );
}
