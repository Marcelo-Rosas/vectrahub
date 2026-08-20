import { FairQuoteCalculator } from '@/components/fair/FairQuoteCalculator';
import { FairTenantLogo } from '@/components/fair/FairTenantLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';
import { isFairDashboardOwner } from '@/lib/fair-dashboard-access';
import { useFairDocumentTheme } from '@/hooks/useFairDocumentTheme';
import { fairPaletteStyle, resolveFairPalette } from '@/lib/fair-brand-palettes';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Shell mobile-first — feira / celular vendedor. */
export default function FairQuotePage() {
  const { signOut, user } = useAuth();
  const { tenant, isLoading } = useFairResolvedTenant();
  const showPainel = isFairDashboardOwner(user?.email);
  const palette = tenant ? resolveFairPalette(tenant.slug) : null;
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
        className="sticky top-0 z-20 shrink-0 border-b bg-background/95 px-3 pb-3 pt-safe-top backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4"
        style={palette ? { borderColor: `${palette.tokens.ink}1A` } : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          {tenant ? (
            <FairTenantLogo tenant={tenant} size="lg" />
          ) : (
            <span className="text-sm">Feira</span>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {showPainel && (
              <Button variant="ghost" size="sm" className="min-h-11 px-2" asChild>
                <Link to="/feira/dashboard">
                  <LayoutDashboard className="mr-1 h-4 w-4" />
                  Painel
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 touch-manipulation text-muted-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-x-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando embarcador…</p>
        ) : !tenant ? (
          <p className="p-6 text-sm text-muted-foreground">
            Domínio não habilitado em feira.companies.
          </p>
        ) : (
          <FairQuoteCalculator />
        )}
      </main>
    </div>
  );
}
