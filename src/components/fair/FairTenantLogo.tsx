import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { resolveFairPalette } from '@/lib/fair-brand-palettes';
import { FAIR_LOCKUP_BOX, FAIR_LOCKUP_IMG, pickFairLockupSrc } from '@/lib/fair-lockup';
import type { FairTenant } from '@/lib/fair-tenant';
import { cn } from '@/lib/utils';

function initialsFromDomainOrName(domain: string, name: string): string {
  const host = domain.replace(/^www\./, '').split('.')[0] ?? '';
  if (host.length >= 2) return host.slice(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.slice(0, 2) || '?').toUpperCase();
}

/** Header /feira — PNG/SVG Brandfetch; senão /brand/{slug}-logo.svg; senão iniciais. */
export function FairTenantLogo({
  tenant,
  logoUrl,
  qualityScore,
  accentHex,
  className,
  imgClassName,
  size = 'sm',
}: {
  tenant: FairTenant;
  logoUrl?: string | null;
  qualityScore?: number | null;
  accentHex?: string | null;
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'auth';
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const palette = resolveFairPalette(tenant.slug);
  const local = tenant.logoSrc?.trim() ?? '';
  const picked = pickFairLockupSrc({
    slug: tenant.slug,
    localSrc: local,
    apiSrc: logoUrl,
    qualityScore,
  });
  const src = picked && failedSrc !== picked ? picked : local && failedSrc !== local ? local : null;
  const accent = accentHex || palette.tokens.accent;
  const isAuth = size === 'auth';
  const isKonnenBanner = tenant.slug.trim().toLowerCase() === 'konnen';

  useEffect(() => {
    setFailedSrc(null);
  }, [logoUrl, tenant.id]);

  return (
    <div
      className={cn(
        isAuth ? 'flex items-center justify-center rounded-lg px-3 py-2' : FAIR_LOCKUP_BOX,
        isKonnenBanner && !isAuth && 'bg-black px-3',
        className
      )}
      style={{
        backgroundColor: isKonnenBanner ? '#000000' : palette.tokens.logoBg,
        boxShadow: isKonnenBanner ? undefined : `inset 0 0 0 1px ${accent}33`,
      }}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={tenant.name}
          className={cn(
            isAuth
              ? 'h-12 w-auto max-w-[260px] object-contain sm:h-14 sm:max-w-[320px]'
              : FAIR_LOCKUP_IMG,
            imgClassName
          )}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          className="flex items-center gap-1.5 text-sm font-semibold tracking-wide"
          style={{ color: palette.tokens.logoFg }}
        >
          <Building2 className="h-4 w-4 opacity-70" aria-hidden />
          {initialsFromDomainOrName(palette.domain, tenant.name)}
        </span>
      )}
    </div>
  );
}
