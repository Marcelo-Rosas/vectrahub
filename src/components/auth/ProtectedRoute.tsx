import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFairCompanies } from '@/hooks/useFairCompanies';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isFairTenantEmail } from '@/lib/fair-tenant';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: UserProfile[];
  allowedEmails?: string[];
  fallback?: ReactNode;
}

function emailAllowed(email: string | undefined, allowedEmails?: string[]): boolean {
  if (!allowedEmails?.length) return true;
  const needle = (email ?? '').trim().toLowerCase();
  return allowedEmails.some((e) => e.trim().toLowerCase() === needle);
}

export function ProtectedRoute({
  children,
  requiredRoles,
  allowedEmails,
  fallback,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { perfil, isLoading: roleLoading } = useUserRole();
  const { data: fairCompanies = [], isLoading: fairCompaniesLoading } = useFairCompanies(!!user);
  const location = useLocation();

  if (loading || fairCompaniesLoading || (!!requiredRoles?.length && user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Save the attempted URL for redirecting after login
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (isFairTenantEmail(user.email, fairCompanies) && !location.pathname.startsWith('/feira')) {
    return <Navigate to="/feira" replace />;
  }

  const roleDenied = !!requiredRoles?.length && (!perfil || !requiredRoles.includes(perfil));
  const emailDenied = !emailAllowed(user.email, allowedEmails);

  if (roleDenied || emailDenied) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Acesso não autorizado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Seu perfil não possui permissão para acessar esta página.
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
