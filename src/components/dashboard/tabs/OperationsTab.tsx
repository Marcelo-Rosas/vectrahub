import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { MonthlyTrendsChart } from '@/components/dashboard/MonthlyTrendsChart';
import { StageDistributionChart } from '@/components/dashboard/StageDistributionChart';
import { RecentOrdersList } from '@/components/dashboard/RecentOrdersList';
import { AlertsWidget } from '@/components/dashboard/AlertsWidget';
import { Database } from '@/integrations/supabase/types';
import { DashboardStats } from '@/hooks/useDashboardStats';

type Order = Database['public']['Tables']['orders']['Row'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type OrderWithOccurrences = Order & {
  occurrences?: Occurrence[];
  occurrence_count?: number;
};

interface OperationsTabProps {
  stats?: DashboardStats;
  ordersLoading: boolean;
  recentOrders: OrderWithOccurrences[];
  onViewAllOrders: () => void;
  onViewOrder: (order: OrderWithOccurrences) => void;
}

export function OperationsTab({
  stats,
  ordersLoading,
  recentOrders,
  onViewAllOrders,
  onViewOrder,
}: OperationsTabProps) {
  return (
    <div className="space-y-6">
      <MonthlyTrendsChart />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StageDistributionChart />
        <div>
          {ordersLoading ? (
            <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <RecentOrdersList
              orders={recentOrders}
              onViewAll={onViewAllOrders}
              onViewOrder={onViewOrder}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsWidget />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-card rounded-xl border border-border shadow-card p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">Resumo de Documentação</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg">
              <span className="font-medium text-foreground">Documentação Completa</span>
              <span className="text-2xl font-bold text-success">
                {stats ? stats.activeOrders - stats.pendingDocuments : 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-warning/10 rounded-lg">
              <span className="font-medium text-foreground">Aguardando Documentos</span>
              <span className="text-2xl font-bold text-warning">
                {stats?.pendingDocuments || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg">
              <span className="font-medium text-foreground">Ocorrências Críticas</span>
              <span className="text-2xl font-bold text-destructive">
                {stats?.criticalAlerts || 0}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
