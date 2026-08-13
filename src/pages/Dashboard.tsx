import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Truck,
  FileText,
  AlertTriangle,
  DollarSign,
  Target,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/KPICard';
import { ExportReports } from '@/components/dashboard/ExportReports';
import { OverviewTab } from '@/components/dashboard/tabs/OverviewTab';
import { CommercialTab } from '@/components/dashboard/tabs/CommercialTab';
import { OperationsTab } from '@/components/dashboard/tabs/OperationsTab';
import { NtcInsightsTab } from '@/components/dashboard/tabs/NtcInsightsTab';
import { MirofishInsightsTab } from '@/components/dashboard/tabs/MirofishInsightsTab';
import { DieselCostTab } from '@/components/dashboard/tabs/DieselCostTab';
import { NtcIndicesCard } from '@/components/dashboard/NtcIndicesCard';
import { NewsTab } from '@/components/dashboard/tabs/NewsTab';
import {
  useDashboardStats,
  useRecentOrders,
  useConversionChartData,
  useRevenueByClientData,
} from '@/hooks/useDashboardStats';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { ApprovalBanner } from '@/components/approvals/ApprovalBanner';
import { AiInsightsWidget } from '@/components/dashboard/AiInsightsWidget';
import { AutomationActivityFeed } from '@/components/dashboard/AutomationActivityFeed';
import { AiUsageDashboard } from '@/components/dashboard/AiUsageDashboard';
import { useUserRole } from '@/hooks/useUserRole';
import { SectionErrorBoundary } from '@/components/ErrorBoundary';
import { toUserMessage } from '@/lib/errors/AppError';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Fallback data for empty states
const emptyConversionData = [
  { name: 'Jan', value: 0 },
  { name: 'Fev', value: 0 },
  { name: 'Mar', value: 0 },
];

const emptyRevenueData = [{ name: 'Sem dados', value: 0 }];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isFinanceiro, isOperacional } = useUserRole();
  const queryClient = useQueryClient();
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsIsError,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStats();
  const {
    data: recentOrders,
    isLoading: ordersLoading,
    isError: ordersIsError,
    error: ordersError,
    refetch: refetchOrders,
  } = useRecentOrders(5);
  const {
    data: conversionData,
    isLoading: conversionLoading,
    isError: conversionIsError,
    error: conversionError,
    refetch: refetchConversion,
  } = useConversionChartData();
  const {
    data: revenueData,
    isLoading: revenueLoading,
    isError: revenueIsError,
    error: revenueError,
    refetch: refetchRevenue,
  } = useRevenueByClientData();

  // Enable realtime updates
  useRealtimeSubscription(['quotes', 'orders', 'occurrences']);

  const chartConversionData = conversionData?.length ? conversionData : emptyConversionData;
  const chartRevenueData = revenueData?.length ? revenueData : emptyRevenueData;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-kpi'] });
    queryClient.invalidateQueries({ queryKey: ['recent-orders'] });
    queryClient.invalidateQueries({ queryKey: ['sales-funnel'] });
    queryClient.invalidateQueries({ queryKey: ['monthly-trends'] });
    queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['quote-stage-distribution'] });
    queryClient.invalidateQueries({ queryKey: ['order-stage-distribution'] });
    queryClient.invalidateQueries({ queryKey: ['ntc-inctl-series'] });
    queryClient.invalidateQueries({ queryKey: ['ntc-inctf-series'] });
    queryClient.invalidateQueries({ queryKey: ['ntc-fuel-reference'] });
    queryClient.invalidateQueries({ queryKey: ['market-index-latest'] });
    queryClient.invalidateQueries({ queryKey: ['market-indices'] });
    queryClient.invalidateQueries({ queryKey: ['ai-usage-stats'] });
    queryClient.invalidateQueries({ queryKey: ['news-items'] });
  };

  const hasPartialError = statsIsError || ordersIsError || conversionIsError || revenueIsError;
  const firstError = (statsError || ordersError || conversionError || revenueError) as unknown;

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo ao Vectra Cargo</h2>
            <p className="text-muted-foreground">Faça login para acessar o dashboard</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Dashboard
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Visão geral do seu pipeline comercial e operacional
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            aria-label="Atualizar dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <ExportReports />
        </motion.div>
      </div>

      {hasPartialError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Algumas seções falharam ao carregar</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{toUserMessage(firstError, 'Erro ao buscar dados do dashboard.')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchStats();
                refetchOrders();
                refetchConversion();
                refetchRevenue();
              }}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Approval Banner */}
      <SectionErrorBoundary title="Aprovações indisponíveis">
        <ApprovalBanner />
      </SectionErrorBoundary>

      {/* KPI Cards */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${isOperacional ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-6'} gap-4 mb-8 auto-rows-fr`}
      >
        {statsIsError ? (
          <div className="col-span-full rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-muted-foreground">
            KPIs indisponíveis — {toUserMessage(statsError)}
          </div>
        ) : statsLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Cards comerciais — ocultos para operacional */}
            {!isOperacional && (
              <>
                <KPICard
                  title="Pipeline Total"
                  value={formatCurrency(stats?.pipelineValue || 0, {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  })}
                  icon={DollarSign}
                  trend={stats?.pipelineTrend || undefined}
                  variant="primary"
                  delay={0}
                />
                <KPICard
                  title="Taxa de Conversão"
                  value={`${stats?.conversionRate || 0}%`}
                  icon={Target}
                  trend={stats?.conversionTrend || undefined}
                  variant="success"
                  delay={0.05}
                />
              </>
            )}
            {/* Cards operacionais — visíveis para todos */}
            <KPICard
              title="OS Ativas"
              value={stats?.activeOrders || 0}
              subtitle="Em operação"
              icon={Truck}
              variant="default"
              delay={isOperacional ? 0 : 0.1}
            />
            <KPICard
              title="Entregas Hoje"
              value={stats?.deliveriesToday || 0}
              subtitle="Previstas"
              icon={TrendingUp}
              variant="default"
              delay={isOperacional ? 0.05 : 0.15}
            />
            <KPICard
              title="Docs Pendentes"
              value={stats?.pendingDocuments || 0}
              subtitle="Aguardando"
              icon={FileText}
              variant="warning"
              delay={isOperacional ? 0.1 : 0.2}
            />
            <KPICard
              title="Alertas Críticos"
              value={stats?.criticalAlerts || 0}
              subtitle="Requer ação"
              icon={AlertTriangle}
              variant="destructive"
              delay={isOperacional ? 0.15 : 0.25}
            />
          </>
        )}
      </div>

      {/* AI Insights + Activity Feed + Usage */}
      <div
        className={`grid grid-cols-1 ${isAdmin || isFinanceiro ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 mb-8`}
      >
        <SectionErrorBoundary title="Insights de IA indisponíveis">
          <AiInsightsWidget />
        </SectionErrorBoundary>
        <SectionErrorBoundary title="Feed de automação indisponível">
          <AutomationActivityFeed />
        </SectionErrorBoundary>
        {(isAdmin || isFinanceiro) && (
          <SectionErrorBoundary title="Uso de IA indisponível">
            <AiUsageDashboard />
          </SectionErrorBoundary>
        )}
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="commercial">Comercial</TabsTrigger>
          <TabsTrigger value="operations">Operacional</TabsTrigger>
          <TabsTrigger value="ntc-insights">Inteligência NTC</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="mirofish">Inteligência MiroFish</TabsTrigger>
          <TabsTrigger value="diesel">Custo Diesel</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SectionErrorBoundary title="Visão geral indisponível">
            <OverviewTab
              chartConversionData={chartConversionData}
              chartRevenueData={chartRevenueData}
              chartsLoading={conversionLoading || revenueLoading}
              ordersLoading={ordersLoading}
              recentOrders={recentOrders || []}
              onViewAllOrders={() => navigate('/operacional')}
              onViewOrder={(order) => navigate(`/operacional?orderId=${order.id}`)}
            />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-6">
          <SectionErrorBoundary title="Aba comercial indisponível">
            <CommercialTab
              chartConversionData={chartConversionData}
              chartRevenueData={chartRevenueData}
              chartsLoading={conversionLoading || revenueLoading}
            />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <SectionErrorBoundary title="Aba operacional indisponível">
            <OperationsTab
              stats={stats}
              ordersLoading={ordersLoading}
              recentOrders={recentOrders || []}
              onViewAllOrders={() => navigate('/operacional')}
              onViewOrder={(order) => navigate(`/operacional?orderId=${order.id}`)}
            />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="ntc-insights" className="space-y-6">
          <SectionErrorBoundary title="Inteligência NTC indisponível">
            <NtcIndicesCard />
            <NtcInsightsTab />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="news" className="space-y-6">
          <SectionErrorBoundary title="News indisponível">
            <NewsTab />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="mirofish" className="space-y-6">
          <SectionErrorBoundary title="MiroFish indisponível">
            <MirofishInsightsTab />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="diesel" className="space-y-6">
          <SectionErrorBoundary title="Custo diesel indisponível">
            <DieselCostTab />
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
