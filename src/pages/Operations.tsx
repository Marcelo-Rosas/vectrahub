import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { motion } from 'framer-motion';
import {
  Plus,
  Filter,
  Search,
  List,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Pencil,
  XCircle,
  AlertTriangle,
  FileText,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  X,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { OrderCard } from '@/components/boards/OrderCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useOrders,
  useUpdateOrderStage,
  useDeleteOrder,
  OrderWithOccurrences,
} from '@/hooks/useOrders';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Database } from '@/integrations/supabase/types';
import { findContainer, moveItem, resolveDropContainer, type ItemsState } from '@/lib/kanban-dnd';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { OrderForm } from '@/components/forms/OrderForm';
import { OrderDetailModal } from '@/components/modals/OrderDetailModal';
import { OccurrenceForm } from '@/components/forms/OccurrenceForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type OrderStage = Database['public']['Enums']['order_stage'];

const ORDER_STAGES: { id: OrderStage; label: string; color: string }[] = [
  { id: 'ordem_criada', label: 'Ordem Criada', color: 'bg-slate-500' },
  { id: 'busca_motorista', label: 'Busca Motorista', color: 'bg-violet-500' },
  { id: 'documentacao', label: 'Documentação', color: 'bg-primary' },
  { id: 'coleta_realizada', label: 'Coleta Realizada', color: 'bg-orange-500' },
  { id: 'em_transito', label: 'Em Trânsito', color: 'bg-blue-500' },
  { id: 'entregue', label: 'Entregue', color: 'bg-emerald-500' },
];

/** Dot color for Kanban column headers */
const stageColors: Record<OrderStage, string> = {
  ordem_criada: 'bg-slate-500',
  busca_motorista: 'bg-violet-500',
  documentacao: 'bg-primary',
  coleta_realizada: 'bg-orange-500',
  em_transito: 'bg-blue-500',
  entregue: 'bg-emerald-500',
};

/** Badge classes for the List view (background + text) */
const stageBadgeClasses: Record<OrderStage, string> = {
  ordem_criada: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  busca_motorista: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  documentacao: 'bg-primary/10 text-primary',
  coleta_realizada: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  em_transito: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  entregue: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
};

export default function Operations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const { data: orders, isLoading, isError, error, refetch } = useOrders();
  const updateStageMutation = useUpdateOrderStage();
  const deleteOrderMutation = useDeleteOrder();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithOccurrences | null>(null);
  const [occurrenceOrder, setOccurrenceOrder] = useState<OrderWithOccurrences | null>(null);
  const [cancelOrder, setCancelOrder] = useState<OrderWithOccurrences | null>(null);
  const canManageOperations = canWrite;

  // Filtros avançados
  const [filterStages, setFilterStages] = useState<Set<OrderStage>>(new Set());
  const [filterHasOccurrences, setFilterHasOccurrences] = useState<boolean | null>(null);
  const [filterHasPendingDocs, setFilterHasPendingDocs] = useState<boolean | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFilterCount =
    filterStages.size +
    (filterHasOccurrences !== null ? 1 : 0) +
    (filterHasPendingDocs !== null ? 1 : 0);

  // Ordenação da tabela
  type SortKey = 'os_number' | 'client_name' | 'value' | 'created_at' | 'stage';
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  // Enable realtime updates
  useRealtimeSubscription(['orders', 'occurrences']);

  // Deep-link support: /operacional?orderId=<uuid>
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (!orderId) return;
    if (!orders || orders.length === 0) return;

    const order = orders.find((o) => o.id === orderId);
    if (order) setSelectedOrder(order);
  }, [searchParams, orders]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let result = orders;

    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.os_number.toLowerCase().includes(term) ||
          o.client_name.toLowerCase().includes(term) ||
          o.origin.toLowerCase().includes(term) ||
          o.destination.toLowerCase().includes(term) ||
          (o.driver_name && o.driver_name.toLowerCase().includes(term))
      );
    }

    // Stage filter
    if (filterStages.size > 0) {
      result = result.filter((o) => filterStages.has(o.stage));
    }

    // Occurrences filter
    if (filterHasOccurrences === true) {
      result = result.filter((o) => (o.occurrence_count ?? o.occurrences?.length ?? 0) > 0);
    } else if (filterHasOccurrences === false) {
      result = result.filter((o) => (o.occurrence_count ?? o.occurrences?.length ?? 0) === 0);
    }

    // Pending docs filter
    if (filterHasPendingDocs === true) {
      result = result.filter((o) => !o.has_nfe || !o.has_cte || !o.has_pod);
    } else if (filterHasPendingDocs === false) {
      result = result.filter((o) => o.has_nfe && o.has_cte && o.has_pod);
    }

    // Sort (for list view)
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'os_number':
          cmp = a.os_number.localeCompare(b.os_number);
          break;
        case 'client_name':
          cmp = a.client_name.localeCompare(b.client_name);
          break;
        case 'value':
          cmp = Number(a.value) - Number(b.value);
          break;
        case 'stage': {
          const stageOrder = ORDER_STAGES.map((s) => s.id);
          cmp = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
          break;
        }
        case 'created_at':
        default:
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [
    orders,
    searchTerm,
    filterStages,
    filterHasOccurrences,
    filterHasPendingDocs,
    sortKey,
    sortDir,
  ]);

  type OrderItemsState = ItemsState<OrderWithOccurrences>;

  const buildItemsState = useCallback((source: OrderWithOccurrences[]): OrderItemsState => {
    const base: OrderItemsState = {
      ordem_criada: [],
      busca_motorista: [],
      documentacao: [],
      coleta_realizada: [],
      em_transito: [],
      entregue: [],
    };
    for (const order of source) {
      base[order.stage]?.push(order);
    }
    return base;
  }, []);

  const [items, setItems] = useState<OrderItemsState>(() => buildItemsState(filteredOrders));

  // Snapshot taken at drag-start for rollback if the mutation fails.
  const snapshotRef = useRef<OrderItemsState | null>(null);

  // Prevents jitter when a card crosses a container boundary rapidly.
  const recentlyMovedToNewContainer = useRef(false);

  // Keep local items in sync with filters while no drag is active.
  useEffect(() => {
    if (activeId) return;
    setItems(buildItemsState(filteredOrders));
  }, [filteredOrders, buildItemsState, activeId]);

  const activeOrder = useMemo(
    () => (activeId ? (orders?.find((o) => o.id === activeId) ?? null) : null),
    [activeId, orders]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveId(id);
      snapshotRef.current = items;
    },
    [items]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    setItems((previous) => {
      const next = moveItem(previous, active.id, over.id);
      if (!next) return previous;

      const fromContainer = findContainer(previous, active.id);
      const toContainer = findContainer(next, active.id);

      if (fromContainer && toContainer && fromContainer !== toContainer) {
        if (recentlyMovedToNewContainer.current) {
          return previous;
        }
        recentlyMovedToNewContainer.current = true;
        requestAnimationFrame(() => {
          recentlyMovedToNewContainer.current = false;
        });
      }

      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) {
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
          snapshotRef.current = null;
        }
        return;
      }

      const activeIdStr = String(active.id);
      const previous = snapshotRef.current ?? items;
      const { from: fromContainer, to: toContainer } = resolveDropContainer(
        previous,
        items,
        activeIdStr,
        over.id
      );

      if (!fromContainer || !toContainer || fromContainer === toContainer) {
        snapshotRef.current = null;
        return;
      }

      setItems((prev) => moveItem(prev, active.id, over.id) ?? prev);

      const fullOrder = orders?.find((o) => o.id === activeIdStr);
      if (!fullOrder) {
        snapshotRef.current = null;
        return;
      }

      if (!canManageOperations) {
        toast.error('Seu perfil é somente leitura para alterações');
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
        }
        snapshotRef.current = null;
        return;
      }

      const targetStage = toContainer;
      const targetMeta = ORDER_STAGES.find((s) => s.id === targetStage);

      // Validate stage transition (can't skip to entregue without POD)
      if (targetStage === 'entregue' && !fullOrder.has_pod) {
        toast.error('É necessário anexar o comprovante de entrega (POD) antes de finalizar');
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
        }
        snapshotRef.current = null;
        return;
      }

      try {
        await updateStageMutation.mutateAsync({
          id: fullOrder.id,
          stage: targetStage,
        });
        toast.success(`OS movida para ${targetMeta?.label ?? targetStage}`);
      } catch (error: unknown) {
        const msg = (error instanceof Error ? error.message : String(error)).toString();
        if (
          msg.toLowerCase().includes('pod obrigatório') ||
          msg.toLowerCase().includes('pod obrigatorio')
        ) {
          toast.error('Anexe o comprovante de entrega (POD) antes de finalizar');
        } else {
          toast.error('Erro ao mover OS');
        }

        if (snapshotRef.current) {
          setItems(snapshotRef.current);
        }
      } finally {
        snapshotRef.current = null;
      }
    },
    [canManageOperations, items, orders, updateStageMutation]
  );

  const handleConfirmCancelOrder = async () => {
    if (!cancelOrder) return;
    try {
      await deleteOrderMutation.mutateAsync(cancelOrder.id);
      toast.success(`OS ${cancelOrder.os_number} cancelada com sucesso`);
      setCancelOrder(null);
    } catch {
      toast.error('Erro ao cancelar OS');
    }
  };

  const handleGenerateCiot = async (order: OrderWithOccurrences) => {
    try {
      toast.info(`Gerando CIOT para OS ${order.os_number}...`);
      const result = await invokeEdgeFunction<{
        success: boolean;
        ciotNumber?: string;
        status?: string;
        message?: string;
        operationId?: string;
        anttPisoMinimo?: number;
        belowFloor?: boolean;
      }>('generate-ciot', {
        body: { orderId: order.id },
      });

      if (result.success && result.ciotNumber) {
        toast.success(`CIOT ${result.ciotNumber} gerado com sucesso`);
        refetch();
      } else {
        toast.error(result.message || 'Falha ao gerar CIOT');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao gerar CIOT: ${msg}`);
    }
  };

  const activeOrdersCount = orders?.filter((o) => o.stage !== 'entregue').length || 0;
  const pendingDeliveries = orders?.filter((o) => o.stage === 'em_transito').length || 0;

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar o board operacional</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isError) {
    return (
      <MainLayout>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar as OS</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) ||
              'Erro inesperado ao buscar ordens de serviço.'}
          </p>
          <div className="mt-4">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Board Operacional
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="font-semibold text-primary">{activeOrdersCount}</span> ordens ativas •{' '}
            <span className="font-semibold text-warning">{pendingDeliveries}</span> em trânsito
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kanban' | 'list')}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar OS, cliente..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative"
                aria-label="Filtrar ordens de serviço"
              >
                <Filter className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Filtros</h4>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setFilterStages(new Set());
                        setFilterHasOccurrences(null);
                        setFilterHasPendingDocs(null);
                      }}
                    >
                      <X className="w-3 h-3 mr-1" /> Limpar
                    </Button>
                  )}
                </div>

                {/* Stage filters */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-medium">Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ORDER_STAGES.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={filterStages.has(s.id)}
                          onCheckedChange={(checked) => {
                            setFilterStages((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(s.id);
                              else next.delete(s.id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-xs flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full', s.color)} />
                          {s.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Occurrences filter */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-medium">Ocorrências</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={filterHasOccurrences === true ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() =>
                        setFilterHasOccurrences(filterHasOccurrences === true ? null : true)
                      }
                    >
                      Com ocorrências
                    </Button>
                    <Button
                      variant={filterHasOccurrences === false ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() =>
                        setFilterHasOccurrences(filterHasOccurrences === false ? null : false)
                      }
                    >
                      Sem ocorrências
                    </Button>
                  </div>
                </div>

                {/* Docs filter */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-medium">Documentos</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={filterHasPendingDocs === true ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() =>
                        setFilterHasPendingDocs(filterHasPendingDocs === true ? null : true)
                      }
                    >
                      Docs pendentes
                    </Button>
                    <Button
                      variant={filterHasPendingDocs === false ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() =>
                        setFilterHasPendingDocs(filterHasPendingDocs === false ? null : false)
                      }
                    >
                      Docs completos
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {canManageOperations && (
            <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4" />
              Nova OS
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Kanban Board */}
          {viewMode === 'kanban' && (
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
                {ORDER_STAGES.map((stage) => {
                  const columnItems = items[stage.id] ?? [];
                  return (
                    <KanbanColumn
                      key={stage.id}
                      id={stage.id}
                      title={stage.label}
                      count={columnItems.length}
                      color={stageColors[stage.id]}
                      items={columnItems.map((o) => o.id)}
                    >
                      {columnItems.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onEdit={() => setSelectedOrder(order)}
                          onRegisterOccurrence={
                            canManageOperations ? () => setOccurrenceOrder(order) : undefined
                          }
                          onCancelOrder={
                            canManageOperations ? () => setCancelOrder(order) : undefined
                          }
                          onGenerateCiot={
                            canManageOperations ? () => handleGenerateCiot(order) : undefined
                          }
                          canManageActions={canManageOperations}
                        />
                      ))}
                    </KanbanColumn>
                  );
                })}
              </div>

              <DragOverlay>
                {activeOrder && (
                  <OrderCard order={activeOrder} canManageActions={canManageOperations} />
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
            >
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma ordem de serviço encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th
                          className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                          onClick={() => handleSort('os_number')}
                        >
                          <span className="inline-flex items-center">
                            OS <SortIcon col="os_number" />
                          </span>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                          onClick={() => handleSort('client_name')}
                        >
                          <span className="inline-flex items-center">
                            Cliente <SortIcon col="client_name" />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Rota
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Motorista
                        </th>
                        <th
                          className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                          onClick={() => handleSort('stage')}
                        >
                          <span className="inline-flex items-center">
                            Status <SortIcon col="stage" />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Docs
                        </th>
                        <th
                          className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                          onClick={() => handleSort('value')}
                        >
                          <span className="inline-flex items-center justify-end">
                            Valor <SortIcon col="value" />
                          </span>
                        </th>
                        {canManageOperations && (
                          <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-16">
                            Ações
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOrders.map((order) => {
                        const stage = ORDER_STAGES.find((s) => s.id === order.stage);
                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <td className="px-4 py-3 font-medium text-foreground">
                              {order.os_number}
                            </td>
                            <td className="px-4 py-3 text-foreground">{order.client_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {order.origin} → {order.destination}
                            </td>
                            <td className="px-4 py-3 text-foreground">
                              {order.driver_name || '-'}
                            </td>
                            <td className="px-4 py-3">
                              {canManageOperations && order.stage !== 'entregue' ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className={cn(
                                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all',
                                        stageBadgeClasses[order.stage]
                                      )}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {stage?.label}
                                      <ChevronDown className="w-3 h-3 opacity-60" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    {ORDER_STAGES.filter((s) => s.id !== order.stage).map((s) => (
                                      <DropdownMenuItem
                                        key={s.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (s.id === 'entregue' && !order.has_pod) {
                                            toast.error('Anexe o POD antes de finalizar');
                                            return;
                                          }
                                          updateStageMutation
                                            .mutateAsync({ id: order.id, stage: s.id })
                                            .then(() => {
                                              toast.success(`OS movida para ${s.label}`);
                                            })
                                            .catch(() => {
                                              toast.error('Erro ao mover OS');
                                            });
                                        }}
                                      >
                                        <span
                                          className={cn('w-2 h-2 rounded-full mr-2', s.color)}
                                        />
                                        {s.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${stageBadgeClasses[order.stage]}`}
                                >
                                  {stage?.label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${order.has_nfe ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-muted text-muted-foreground/50'}`}
                                  title="Nota Fiscal Eletrônica"
                                >
                                  NF-e
                                </span>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${order.has_cte ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-muted text-muted-foreground/50'}`}
                                  title="Conhecimento de Transporte"
                                >
                                  CT-e
                                </span>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${order.has_pod ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-muted text-muted-foreground/50'}`}
                                  title="Comprovante de Entrega"
                                >
                                  POD
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(Number(order.value))}
                            </td>
                            {canManageOperations && (
                              <td className="px-4 py-3 text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrder(order);
                                      }}
                                    >
                                      <Pencil className="w-4 h-4 mr-2" /> Ver / Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(order.os_number);
                                        toast.success('Nº OS copiado');
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-2" /> Copiar Nº OS
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOccurrenceOrder(order);
                                      }}
                                    >
                                      <AlertTriangle className="w-4 h-4 mr-2" /> Registrar
                                      Ocorrência
                                    </DropdownMenuItem>
                                    {order.stage !== 'entregue' && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCancelOrder(order);
                                          }}
                                        >
                                          <XCircle className="w-4 h-4 mr-2" /> Cancelar OS
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* Order Form Modal */}
      <OrderForm open={isFormOpen} onClose={() => setIsFormOpen(false)} />

      {/* Order Detail Modal */}
      <OrderDetailModal
        open={!!selectedOrder}
        onClose={() => {
          setSelectedOrder(null);
          // If opened via deep-link, clean the URL
          if (searchParams.get('orderId')) {
            navigate('/operacional', { replace: true });
          }
        }}
        order={selectedOrder}
        canManage={canManageOperations}
      />

      {/* Occurrence Form */}
      {occurrenceOrder && (
        <OccurrenceForm
          open={!!occurrenceOrder}
          onClose={() => setOccurrenceOrder(null)}
          orderId={occurrenceOrder.id}
          osNumber={occurrenceOrder.os_number}
        />
      )}

      {/* Modal: Confirmar cancelamento de OS */}
      <Dialog
        open={!!cancelOrder}
        onOpenChange={(open) => {
          if (!open) setCancelOrder(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Cancelar Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar a{' '}
              <span className="font-semibold text-foreground">{cancelOrder?.os_number}</span> (
              {cancelOrder?.client_name})? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrder(null)}>
              Manter OS
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancelOrder}
              disabled={deleteOrderMutation.isPending}
            >
              {deleteOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
