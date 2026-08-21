import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { resolveFairPalette } from '@/lib/fair-brand-palettes';
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
  const img =
    size === 'auth'
      ? 'h-12 w-auto max-w-[260px] sm:h-14 sm:max-w-[320px]'
      : size === 'lg'
        ? 'h-10 w-auto max-w-[240px] sm:h-12 sm:max-w-[280px]'
        : size === 'md'
          ? 'h-9 w-auto max-w-[200px] sm:h-10 sm:max-w-[240px]'
          : 'h-8 w-auto max-w-[180px] sm:h-9 sm:max-w-[200px]';
  const pad = size === 'auth' ? 'px-3 py-2' : size === 'lg' ? 'px-2.5 py-1.5' : 'px-2 py-1';
  const palette = resolveFairPalette(tenant.slug);
  const local = tenant.logoSrc?.trim() ?? '';
  const api = tenant.slug === 'rotha' || tenant.slug === 'playfit' ? '' : (logoUrl?.trim() ?? '');
  const src = api && failedSrc !== api ? api : local && failedSrc !== local ? local : null;
  const accent = accentHex || palette.tokens.accent;

  useEffect(() => {
    setFailedSrc(null);
  }, [logoUrl, tenant.id]);

  return (
    <div
      className={cn('flex items-center justify-center rounded-lg', pad, className)}
      style={{
        backgroundColor: palette.tokens.logoBg,
        boxShadow: `inset 0 0 0 1px ${accent}33`,
      }}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={tenant.name}
          className={cn(img, 'object-contain', imgClassName)}
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
