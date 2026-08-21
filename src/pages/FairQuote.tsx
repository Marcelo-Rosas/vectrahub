import { FairQuoteCalculator } from '@/components/fair/FairQuoteCalculator';
import { FairTenantLogo } from '@/components/fair/FairTenantLogo';
import { FairTenantSwitcher } from '@/components/fair/FairTenantSwitcher';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';
import { useFairBrand } from '@/hooks/useFairBrand';
import { isFairStaffTester } from '@/lib/fair-dashboard-access';
import { useFairDocumentTheme } from '@/hooks/useFairDocumentTheme';
import { fairPaletteStyle } from '@/lib/fair-brand-palettes';
import { LayoutDashboard, LogOut, Zap } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

/** Shell mobile-first — feira / celular vendedor. */
export default function FairQuotePage() {
  const { signOut, user } = useAuth();
  const { tenant, companies, isLoading, canSwitchTenant, setTenantSlug } = useFairResolvedTenant();
  const { palette, logoUrl, qualityScore, accentHex } = useFairBrand(tenant);
  const showPainel = isFairStaffTester(user?.email);
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
        <div className="mx-auto flex max-w-2xl flex-col gap-2 md:max-w-3xl">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {canSwitchTenant && tenant ? (
                <FairTenantSwitcher
                  tenants={companies}
                  value={tenant.slug}
                  onValueChange={setTenantSlug}
                  className="h-10 w-full max-w-[260px] touch-manipulation md:h-9"
                />
              ) : tenant ? (
                <FairTenantLogo
                  tenant={tenant}
                  logoUrl={logoUrl}
                  qualityScore={qualityScore}
                  accentHex={accentHex}
                  size="lg"
                  className="md:px-2.5 md:py-1.5"
                  imgClassName="md:h-12 md:max-w-[280px]"
                />
              ) : (
                <span className="text-sm">Feira</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 px-2 md:min-h-8 md:h-8 md:px-2.5"
                asChild
              >
                <Link to="/feira/simples">
                  <Zap className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Rápido</span>
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
                    <LayoutDashboard className="mr-1 h-4 w-4" />
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
                <LogOut className="mr-1.5 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
          {canSwitchTenant && tenant ? (
            <FairTenantLogo
              tenant={tenant}
              logoUrl={logoUrl}
              qualityScore={qualityScore}
              accentHex={accentHex}
              size="md"
              className="w-fit"
              imgClassName="md:h-10 md:max-w-[240px]"
            />
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-x-hidden md:overflow-y-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando embarcador…</p>
        ) : !tenant ? (
          <p className="p-6 text-sm text-muted-foreground">
            Domínio não habilitado em feira.companies.
          </p>
        ) : tenant.slug === 'playfit' ? (
          <Navigate to="/feira/simples" replace />
        ) : (
          <FairQuoteCalculator key={tenant.slug} />
        )}
      </main>
    </div>
  );
}
