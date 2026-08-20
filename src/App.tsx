import { Suspense, lazy } from 'react';

import { RouteErrorBoundary } from '@/components/ErrorBoundary';
import { SuspenseFallback } from '@/components/SuspenseFallback';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/useAuth';
import { isTransientError } from '@/lib/errors/AppError';
import { Sentry } from '@/lib/sentry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

// Lazy routes (code-splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Commercial = lazy(() => import('./pages/Commercial'));
const Operations = lazy(() => import('./pages/Operations'));
const Documents = lazy(() => import('./pages/Documents'));
const Clients = lazy(() => import('./pages/Clients'));
const Shippers = lazy(() => import('./pages/Shippers'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const PriceTables = lazy(() => import('./pages/PriceTables'));
const Financial = lazy(() => import('./pages/Financial'));
const Reports = lazy(() => import('./pages/Reports'));
const Approvals = lazy(() => import('./pages/Approvals'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const CompanySettings = lazy(() => import('./pages/CompanySettings'));
const Auth = lazy(() => import('./pages/Auth'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const InsuranceMonitoringDashboard = lazy(() =>
  import('./pages/InsuranceMonitoringDashboard').then((m) => ({
    default: m.InsuranceMonitoringDashboard,
  }))
);
const NotFound = lazy(() => import('./pages/NotFound'));
const FairQuote = lazyWithRetry(() => import('./pages/FairQuote'));
const FairSimpleQuote = lazyWithRetry(() => import('./pages/FairSimpleQuote'));
const FairDashboard = lazyWithRetry(() => import('./pages/FairDashboard'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => isTransientError(error) && failureCount < 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => isTransientError(error) && failureCount < 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<SuspenseFallback />}>
            <SentryRoutes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route
                path="/feira"
                element={
                  <ProtectedRoute>
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={
                    <RouteErrorBoundary
                      title="Erro na cotação feira"
                      description="Recarregue a página ou tente novamente."
                    >
                      <FairQuote />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="simples"
                  element={
                    <RouteErrorBoundary
                      title="Erro na cotação rápida"
                      description="Recarregue a página ou tente novamente."
                    >
                      <FairSimpleQuote />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute allowFairStaffTester>
                      <RouteErrorBoundary
                        title="Erro no dashboard feira"
                        description="Recarregue a página ou tente novamente."
                      >
                        <FairDashboard />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="/feira/simple" element={<Navigate to="/feira/simples" replace />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary
                      title="Erro no Dashboard"
                      description="Ocorreu um erro ao carregar o dashboard. Tente novamente."
                    >
                      <Dashboard />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/comercial"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <RouteErrorBoundary
                      title="Erro no módulo Comercial"
                      description="Ocorreu um erro no Kanban de cotações. Tente novamente."
                    >
                      <Commercial />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operacional"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <RouteErrorBoundary
                      title="Erro no módulo Operacional"
                      description="Ocorreu um erro no Kanban de ordens de serviço. Tente novamente."
                    >
                      <Operations />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documentos"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary
                      title="Erro no módulo Documentos"
                      description="Ocorreu um erro ao carregar documentos. Tente novamente."
                    >
                      <Documents />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clientes"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary
                      title="Erro no módulo Clientes"
                      description="Ocorreu um erro ao carregar clientes. Tente novamente."
                    >
                      <Clients />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/embarcadores"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary
                      title="Erro no módulo Embarcadores"
                      description="Ocorreu um erro ao carregar embarcadores. Tente novamente."
                    >
                      <Shippers />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/proprietarios"
                element={
                  <ProtectedRoute>
                    <Navigate to="/veiculos?tab=proprietarios" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/motoristas"
                element={
                  <ProtectedRoute>
                    <Navigate to="/veiculos?tab=motoristas" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/veiculos"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary
                      title="Erro no módulo Veículos"
                      description="Ocorreu um erro ao carregar veículos. Tente novamente."
                    >
                      <Vehicles />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tabelas-preco"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'operacional', 'financeiro']}>
                    <RouteErrorBoundary
                      title="Erro no módulo Tabelas de Preço"
                      description="Ocorreu um erro ao carregar tabelas de preço. Tente novamente."
                    >
                      <PriceTables />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <RouteErrorBoundary
                      title="Erro no módulo Financeiro"
                      description="Ocorreu um erro no painel financeiro. Tente novamente."
                    >
                      <Financial />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary
                      title="Erro no módulo Relatórios"
                      description="Ocorreu um erro ao carregar relatórios. Tente novamente."
                    >
                      <Reports />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/aprovacoes"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro']}>
                    <RouteErrorBoundary
                      title="Erro no módulo Aprovações"
                      description="Ocorreu um erro ao carregar aprovações. Tente novamente."
                    >
                      <Approvals />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <RouteErrorBoundary
                      title="Erro no módulo Usuários"
                      description="Ocorreu um erro ao carregar usuários. Tente novamente."
                    >
                      <UserManagement />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes-empresa"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <RouteErrorBoundary
                      title="Erro nas Configurações da Empresa"
                      description="Ocorreu um erro ao carregar as configurações. Tente novamente."
                    >
                      <CompanySettings />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/monitoramento-seguros"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <RouteErrorBoundary
                      title="Erro no módulo Monitoramento de Seguros"
                      description="Ocorreu um erro ao carregar o monitoramento de seguros. Tente novamente."
                    >
                      <InsuranceMonitoringDashboard />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </SentryRoutes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
