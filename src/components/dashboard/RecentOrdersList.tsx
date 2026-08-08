import { motion } from 'framer-motion';
import { ArrowRight, Truck, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';

type Order = Database['public']['Tables']['orders']['Row'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type OrderStage = Database['public']['Enums']['order_stage'];

interface OrderWithOccurrences extends Order {
  occurrences?: Occurrence[];
  occurrence_count?: number;
}

const ORDER_STAGES: { id: OrderStage; label: string }[] = [
  { id: 'ordem_criada', label: 'Ordem Criada' },
  { id: 'busca_motorista', label: 'Busca Motorista' },
  { id: 'documentacao', label: 'Documentação' },
  { id: 'coleta_realizada', label: 'Coleta Realizada' },
  { id: 'em_transito', label: 'Em Trânsito' },
  { id: 'entregue', label: 'Entregue' },
];

interface RecentOrdersListProps {
  orders: OrderWithOccurrences[];
  onViewOrder?: (order: OrderWithOccurrences) => void;
  onViewAll?: () => void;
}

const stageColors: Record<OrderStage, string> = {
  ordem_criada: 'bg-muted text-muted-foreground',
  busca_motorista: 'bg-accent text-accent-foreground',
  documentacao: 'bg-primary/20 text-primary',
  coleta_realizada: 'bg-warning/20 text-warning-foreground',
  em_transito: 'bg-warning/30 text-warning-foreground',
  entregue: 'bg-success/20 text-success',
};

export function RecentOrdersList({ orders, onViewOrder, onViewAll }: RecentOrdersListProps) {
  const navigate = useNavigate();

  const handleViewAll = () => {
    if (onViewAll) return onViewAll();
    navigate('/operacional');
  };

  if (!orders || orders.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 0.9, 0.32, 1] }}
        className="bg-card rounded-xl border border-border shadow-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Ordens Recentes</h3>
        <EmptyState
          title="Nenhuma ordem de serviço encontrada"
          description="Crie sua primeira OS no board operacional"
          icon={<Truck className="w-10 h-10 text-muted-foreground" />}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 0.9, 0.32, 1] }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Ordens Recentes</h3>
        <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={handleViewAll}>
          Ver todas <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {orders.slice(0, 5).map((order, index) => {
          const stage = ORDER_STAGES.find((s) => s.id === order.stage);
          const hasOccurrences = (order.occurrence_count ?? order.occurrences?.length ?? 0) > 0;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 * index }}
              className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => onViewOrder?.(order)}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    order.stage === 'entregue' ? 'bg-success/10' : 'bg-primary/10'
                  )}
                >
                  {order.stage === 'entregue' ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : hasOccurrences ? (
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  ) : (
                    <Truck className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{order.os_number}</span>
                    <Badge variant="secondary" className={cn('text-xs', stageColors[order.stage])}>
                      {stage?.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.origin} → {order.destination}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{order.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.driver_name || 'Motorista não atribuído'}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 whitespace-nowrap text-xs',
                      order.has_nfe
                        ? 'border-success/50 text-success bg-success/10'
                        : 'border-muted-foreground/20 text-muted-foreground/60'
                    )}
                  >
                    NF-e
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 whitespace-nowrap text-xs',
                      order.has_cte
                        ? 'border-success/50 text-success bg-success/10'
                        : 'border-muted-foreground/20 text-muted-foreground/60'
                    )}
                  >
                    CT-e
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 whitespace-nowrap text-xs',
                      order.has_pod
                        ? 'border-success/50 text-success bg-success/10'
                        : 'border-muted-foreground/20 text-muted-foreground/60'
                    )}
                  >
                    POD
                  </Badge>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
