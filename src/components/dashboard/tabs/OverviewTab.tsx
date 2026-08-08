import { Loader2 } from 'lucide-react';
import { RecentOrdersList } from '@/components/dashboard/RecentOrdersList';
import { AlertsWidget } from '@/components/dashboard/AlertsWidget';
import { MonthlyTrendsChart } from '@/components/dashboard/MonthlyTrendsChart';
import { PerformanceCards } from '@/components/dashboard/PerformanceCards';
import { ConversionChart } from '@/components/dashboard/charts/ConversionChart';
import { RevenueByClientChart } from '@/components/dashboard/charts/RevenueByClientChart';
import { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type OrderWithOccurrences = Order & {
  occurrences?: Occurrence[];
  occurrence_count?: number;
};

interface ChartPoint {
  name: string;
  value: number;
}

interface OverviewTabProps {
  chartConversionData: ChartPoint[];
  chartRevenueData: ChartPoint[];
  chartsLoading?: boolean;
  ordersLoading: boolean;
  recentOrders: OrderWithOccurrences[];
  onViewAllOrders: () => void;
  onViewOrder: (order: OrderWithOccurrences) => void;
}

export function OverviewTab({
  chartConversionData,
  chartRevenueData,
  chartsLoading,
  ordersLoading,
  recentOrders,
  onViewAllOrders,
  onViewOrder,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <PerformanceCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartsLoading ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center justify-center h-[240px]">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <ConversionChart
            title="Taxa de Conversão"
            data={chartConversionData}
            delay={0.2}
            height={240}
          />
        )}
        {chartsLoading ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center justify-center h-[240px]">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <RevenueByClientChart
            title="Faturamento por Cliente"
            data={chartRevenueData}
            delay={0.25}
            height={240}
          />
        )}
      </div>

      <MonthlyTrendsChart />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
        <div>
          <AlertsWidget />
        </div>
      </div>
    </div>
  );
}
