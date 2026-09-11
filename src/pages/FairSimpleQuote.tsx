import { FairSimpleFreightCalculator } from '@/components/fair/FairSimpleFreightCalculator';
import { PlayFitSimpleFreightCalculator } from '@/components/fair/PlayFitSimpleFreightCalculator';
import { FairTenantLogo } from '@/components/fair/FairTenantLogo';
import { FairTenantSwitcher } from '@/components/fair/FairTenantSwitcher';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';
import { useFairBrand } from '@/hooks/useFairBrand';
import { isFairStaffTester } from '@/lib/fair-dashboard-access';
import { useFairDocumentTheme } from '@/hooks/useFairDocumentTheme';
import { fairPaletteStyle } from '@/lib/fair-brand-palettes';
import { LayoutDashboard, LogOut, Package } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

/** Cotação mínima feira — CEP + peso + valor NF. */
export default function FairSimpleQuotePage() {
  const { signOut, user } = useAuth();
  const { tenant, companies, isLoading, canSwitchTenant, setTenantSlug } = useFairResolvedTenant();
  const { palette, logoUrl, qualityScore, accentHex } = useFairBrand(tenant);
  const showPainel = isFairStaffTester(user?.email);
  const [searchParams] = useSearchParams();
  const editCot = (searchParams.get('cot') ?? '').trim();
  useFairDocumentTheme(palette);

  return (
    <div
      className="flex min-h-screen-dvh flex-col touch-manipulation"
      style={
        palette
          ? { ...fairPaletteStyle(palette), backgroundColor: palette.tokens.pageBg }
          : undefined
      }
    >
      <header
        className="sticky top-0 z-20 shrink-0 border-b bg-background/95 px-3 pb-2 pt-safe-top backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4 md:pb-1.5"
        style={palette ? { borderColor: `${palette.tokens.ink}1A` } : undefined}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 md:max-w-xl">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {tenant ? (
              <FairTenantLogo
                tenant={tenant}
                logoUrl={logoUrl}
                qualityScore={qualityScore}
                accentHex={accentHex}
                size="lg"
                className="mx-0 shrink-0"
              />
            ) : (
              <span className="text-sm">Feira</span>
            )}
            {canSwitchTenant && tenant ? (
              <FairTenantSwitcher
                tenants={companies}
                value={tenant.slug}
                onValueChange={setTenantSlug}
                className="h-10 min-w-0 max-w-[min(100%,12rem)] flex-1 touch-manipulation md:h-9"
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 px-2 md:min-h-8 md:h-8 md:px-2.5"
              asChild
            >
              <Link to="/feira">
                <Package data-icon="inline-start" />
                <span className="hidden sm:inline">Catálogo</span>
              </Link>
            </Button>
            {showPainel && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 px-2 md:min-h-8 md:h-8 md:px-2.5"
                asChild
              >
                <Link to="/feira/dashboard">
                  <LayoutDashboard data-icon="inline-start" />
                  <span className="hidden sm:inline">Painel</span>
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 touch-manipulation text-muted-foreground md:min-h-8 md:h-8 md:px-2.5"
              onClick={() => signOut()}
            >
              <LogOut data-icon="inline-start" />
              Sair
            </Button>
          </div>
        </div>
        {canSwitchTenant && tenant && showPainel && editCot ? (
          <p className="mx-auto mt-1 max-w-2xl font-mono text-[11px] text-muted-foreground md:max-w-xl">
            Editar {editCot}
          </p>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 scroll-pt-16 overflow-x-hidden md:overflow-y-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando embarcador…</p>
        ) : !tenant ? (
          <p className="p-6 text-sm text-muted-foreground">
            Domínio não habilitado em feira.companies.
          </p>
        ) : tenant.slug === 'playfit' ? (
          <PlayFitSimpleFreightCalculator key={tenant.slug} tenant={tenant} />
        ) : (
          <FairSimpleFreightCalculator key={tenant.slug} />
        )}
      </main>
    </div>
  );
}
