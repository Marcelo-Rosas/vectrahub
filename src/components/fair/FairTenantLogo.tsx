import { resolveFairPalette } from '@/lib/fair-brand-palettes';
import type { FairTenant } from '@/lib/fair-tenant';
import { cn } from '@/lib/utils';

export function FairTenantLogo({
  tenant,
  logoUrl,
  className,
  imgClassName,
  size = 'sm',
}: {
  tenant: FairTenant;
  logoUrl?: string | null;
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'auth';
}) {
  const img =
    size === 'auth'
      ? 'h-10 w-auto max-w-[220px] sm:h-12 sm:max-w-[280px]'
      : size === 'lg'
        ? 'h-8 w-auto max-w-[200px] sm:h-10 sm:max-w-[240px]'
        : size === 'md'
          ? 'h-6 w-auto max-w-[148px] sm:h-7 sm:max-w-[168px]'
          : 'h-5 w-auto max-w-[120px] sm:h-6 sm:max-w-[148px]';
  const pad = size === 'auth' ? 'px-5 py-3.5' : size === 'lg' ? 'px-3.5 py-2.5' : 'px-2.5 py-1.5';
  const palette = resolveFairPalette(tenant.slug);
  const src = logoUrl?.trim() || tenant.logoSrc;

  return (
    <div
      className={cn('flex items-center justify-center rounded-lg', pad, className)}
      style={{ backgroundColor: palette.tokens.logoBg }}
    >
      <img
        src={src}
        alt={tenant.name}
        className={cn(img, 'object-contain', imgClassName)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
