import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  usePriceTables,
  useCreatePriceTable,
  useUpdatePriceTable,
  useDeletePriceTable,
  useSetActivePriceTable,
  useActivePriceTable,
} from '@/hooks/usePriceTables';
import { usePriceTableRows } from '@/hooks/usePriceTableRows';
import {
  useIcmsRates,
  useCreateIcmsRate,
  useUpdateIcmsRate,
  useDeleteIcmsRate,
  useUpsertIcmsRates,
} from '@/hooks/useIcmsRates';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  TableIcon,
  Activity,
  Receipt,
  Upload,
  FileSpreadsheet,
  Settings2,
  Calculator,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PriceTableImportModal } from '@/components/pricing/PriceTableImportModal';
import { PricingRulesTab } from '@/components/pricing/PricingRulesTab';
import { FreightSimulator } from '@/components/pricing/FreightSimulator';
import { parseIcmsFile, ParsedIcmsRow } from '@/lib/priceTableParser';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_tables']['Row'];
type IcmsRateRow = Database['public']['Tables']['icms_rates']['Row'];

const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

const VALID_TABS = ['tabelas', 'vigentes', 'icms', 'regras', 'simulador'] as const;

export default function PriceTables() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? (tabParam as (typeof VALID_TABS)[number])
    : 'tabelas';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tabelas de Preço</h1>
          <p className="text-muted-foreground">
            Gerencie tabelas de preço, vigências e alíquotas de ICMS
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="tabelas" className="gap-2">
              <TableIcon className="h-4 w-4" />
              Tabelas
            </TabsTrigger>
            <TabsTrigger value="vigentes" className="gap-2">
              <Activity className="h-4 w-4" />
              Vigentes
            </TabsTrigger>
            <TabsTrigger value="icms" className="gap-2">
              <Receipt className="h-4 w-4" />
              ICMS
            </TabsTrigger>
            <TabsTrigger value="regras" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Regras
            </TabsTrigger>
            <TabsTrigger value="simulador" className="gap-2">
              <Calculator className="h-4 w-4" />
              Simulador
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tabelas">
            <PriceTablesTab />
          </TabsContent>

          <TabsContent value="vigentes">
            <ActiveTablesTab />
          </TabsContent>

          <TabsContent value="icms">
            <IcmsRatesTab />
          </TabsContent>

          <TabsContent value="regras">
            <PricingRulesTab />
          </TabsContent>

          <TabsContent value="simulador">
            <FreightSimulator />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ======================== TABELAS TAB ========================
function PriceTablesTab() {
  const { data: tables, isLoading } = usePriceTables();
  const createTable = useCreatePriceTable();
  const updateTable = useUpdatePriceTable();
  const deleteTable = useDeletePriceTable();
  const setActive = useSetActivePriceTable();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<PriceTableRow | null>(null);
  const [filterModality, setFilterModality] = useState<string>('all');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const filteredTables =
    tables?.filter((t) => filterModality === 'all' || t.modality === filterModality) || [];

  const handleCreate = async (data: {
    name: string;
    modality: string;
    ad_valorem_lotacao_percent?: number | null;
  }) => {
    try {
      const methodology = data.modality === 'fracionado' ? 'fracionado_ntc' : 'lotacao';
      await createTable.mutateAsync({
        name: data.name,
        modality: data.modality,
        methodology,
        active: false,
        version: 1,
        ad_valorem_lotacao_percent: data.ad_valorem_lotacao_percent ?? null,
      });
      toast.success('Tabela criada com sucesso');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar tabela');
    }
  };

  const handleUpdate = async (
    id: string,
    data: { name: string; modality: string; ad_valorem_lotacao_percent?: number | null }
  ) => {
    try {
      await updateTable.mutateAsync({
        id,
        updates: {
          name: data.name,
          ad_valorem_lotacao_percent: data.ad_valorem_lotacao_percent ?? null,
        },
      });
      toast.success('Tabela atualizada');
      setEditingTable(null);
    } catch (error) {
      toast.error('Erro ao atualizar tabela');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTable.mutateAsync(id);
      toast.success('Tabela excluída');
    } catch (error) {
      toast.error('Erro ao excluir tabela');
    }
  };

  const handleActivate = async (table: PriceTableRow) => {
    try {
      await setActive.mutateAsync({
        modality: table.modality as 'lotacao' | 'fracionado',
        id: table.id,
      });
      toast.success(`Tabela "${table.name}" ativada para ${table.modality}`);
    } catch (error) {
      toast.error('Erro ao ativar tabela');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Tabelas de Preço</CardTitle>
          <CardDescription>Gerencie as tabelas de preço por modalidade</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterModality} onValueChange={setFilterModality}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="lotacao">Lotação</SelectItem>
              <SelectItem value="fracionado">Fracionado</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Faixas
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Tabela
              </Button>
            </DialogTrigger>
            <DialogContent>
              <PriceTableForm onSubmit={handleCreate} isLoading={createTable.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhuma tabela encontrada</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">{table.name}</TableCell>
                  <TableCell>
                    <Badge variant={table.modality === 'lotacao' ? 'default' : 'secondary'}>
                      {table.modality === 'lotacao' ? 'Lotação' : 'Fracionado'}
                    </Badge>
                  </TableCell>
                  <TableCell>v{table.version}</TableCell>
                  <TableCell>
                    {table.active ? (
                      <Badge variant="default">Ativa</Badge>
                    ) : (
                      <Badge variant="outline">Inativa</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(table.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!table.active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(table)}
                          disabled={setActive.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Ativar
                        </Button>
                      )}

                      <Dialog
                        open={editingTable?.id === table.id}
                        onOpenChange={(open) => !open && setEditingTable(null)}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTable(table)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <PriceTableForm
                            initialData={table}
                            onSubmit={(data) => handleUpdate(table.id, data)}
                            isLoading={updateTable.isPending}
                          />
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir tabela?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A tabela "{table.name}" e todas as
                              suas faixas serão excluídas permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(table.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Import Modal */}
      <PriceTableImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        defaultModality={
          filterModality !== 'all' ? (filterModality as 'lotacao' | 'fracionado') : 'lotacao'
        }
      />
    </Card>
  );
}

interface PriceTableFormProps {
  initialData?: { name: string; modality: string; ad_valorem_lotacao_percent?: number | null };
  onSubmit: (data: {
    name: string;
    modality: string;
    ad_valorem_lotacao_percent?: number | null;
  }) => void;
  isLoading: boolean;
}

function PriceTableForm({ initialData, onSubmit, isLoading }: PriceTableFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [modality, setModality] = useState(initialData?.modality || 'lotacao');
  const [adValoremRaw, setAdValoremRaw] = useState(
    initialData?.ad_valorem_lotacao_percent != null
      ? String(initialData.ad_valorem_lotacao_percent)
      : ''
  );

  const isLotacao = modality === 'lotacao';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const adValorem =
      isLotacao && adValoremRaw.trim() !== '' ? Number(adValoremRaw.replace(',', '.')) : null;
    if (
      isLotacao &&
      adValoremRaw.trim() !== '' &&
      (isNaN(adValorem!) || adValorem! < 0 || adValorem! > 2)
    ) {
      toast.error('Ad Valorem deve ser um percentual entre 0 e 2');
      return;
    }
    onSubmit({ name, modality, ad_valorem_lotacao_percent: adValorem });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Tabela' : 'Nova Tabela de Preço'}</DialogTitle>
        <DialogDescription>
          {initialData
            ? 'Atualize as informações da tabela de preço'
            : 'Preencha os dados para criar uma nova tabela'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Tabela Sul 2025"
          />
        </div>
        {!initialData && (
          <div className="space-y-2">
            <Label htmlFor="modality">Modalidade</Label>
            <Select value={modality} onValueChange={setModality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lotacao">Lotação</SelectItem>
                <SelectItem value="fracionado">Fracionado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isLotacao && (
          <div className="space-y-2">
            <Label htmlFor="adValorem">Ad Valorem Lotação (%)</Label>
            <Input
              id="adValorem"
              type="number"
              step="0.001"
              min="0"
              max="2"
              value={adValoremRaw}
              onChange={(e) => setAdValoremRaw(e.target.value)}
              placeholder="Ex: 0.45 — vazio = herdar global"
            />
            <p className="text-xs text-muted-foreground">
              Substitui GRIS+TSO em lotação. Vazio = herdar da Central de Riscos.
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {initialData ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ======================== VIGENTES TAB ========================
function ActiveTablesTab() {
  const { data: activeLotacao, isLoading: loadingLotacao } = useActivePriceTable('lotacao');
  const { data: activeFracionado, isLoading: loadingFracionado } =
    useActivePriceTable('fracionado');

  const isLoading = loadingLotacao || loadingFracionado;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Corrigindo comportamento: se ambas estão vazias, mensagem amigável.
  if (!activeLotacao && !activeFracionado) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Nenhuma tabela ativa encontrada para as modalidades Lotação e Fracionado.
      </div>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ActiveTableCard title="Lotação" table={activeLotacao ?? null} variant="default" />
      <ActiveTableCard title="Fracionado" table={activeFracionado ?? null} variant="secondary" />
    </div>
  );
}

interface ActiveTableCardProps {
  title: string;
  table: PriceTableRow | null;
  variant: 'default' | 'secondary';
}

function ActiveTableCard({ title, table, variant }: ActiveTableCardProps) {
  const { data: rows, isLoading } = usePriceTableRows(table?.id || '');
  const isLtl = table?.modality === 'fracionado';

  // Check if first row has weight_rate data (fracionado with data)
  const firstRow = rows?.[0];
  const hasWeightRates = firstRow && (firstRow as Record<string, unknown>).weight_rate_10 != null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant={variant}>{title}</Badge>
        </div>
        <CardDescription>
          Tabela de preço ativa para a modalidade {title.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!table ? (
          <div className="text-center py-6 text-muted-foreground">Nenhuma tabela ativa</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{table.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Versão</p>
                <p className="font-medium">v{table.version}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Criada em</p>
                <p className="font-medium">
                  {format(new Date(table.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faixas de KM</p>
                <p className="font-medium">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `${rows?.length || 0} faixas`
                  )}
                </p>
              </div>
            </div>
            {isLtl && !isLoading && rows && rows.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Estrutura</p>
                {hasWeightRates ? (
                  <p className="text-sm font-medium text-success">
                    9 faixas de peso (≤10kg a &gt;200kg) por faixa de KM
                  </p>
                ) : (
                  <p className="text-sm font-medium text-warning">
                    Sem dados de faixas de peso — reimporte o CSV fracionado
                  </p>
                )}
              </div>
            )}
            {table.valid_from && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Vigência</p>
                <p className="font-medium">
                  {format(new Date(table.valid_from), 'dd/MM/yyyy', { locale: ptBR })}
                  {table.valid_until &&
                    ` até ${format(new Date(table.valid_until), 'dd/MM/yyyy', { locale: ptBR })}`}
                </p>
              </div>
            )}
            {!isLtl && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Ad Valorem Lotação</p>
                <p className="font-medium">
                  {table.ad_valorem_lotacao_percent != null
                    ? `${table.ad_valorem_lotacao_percent}% (tabela)`
                    : 'Herdado da Central de Riscos'}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ======================== ICMS TAB ========================
function IcmsRatesTab() {
  const { data: rates, isLoading } = useIcmsRates();
  const createRate = useCreateIcmsRate();
  const updateRate = useUpdateIcmsRate();
  const deleteRate = useDeleteIcmsRate();
  const upsertRates = useUpsertIcmsRates();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<IcmsRateRow | null>(null);
  const [filterOrigin, setFilterOrigin] = useState<string>('all');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importParsedRows, setImportParsedRows] = useState<ParsedIcmsRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const filteredRates =
    rates?.filter((r) => filterOrigin === 'all' || r.origin_state === filterOrigin) || [];

  const handleCreate = async (data: {
    origin_state: string;
    destination_state: string;
    rate_percent: number;
  }) => {
    try {
      await createRate.mutateAsync(data);
      toast.success('Alíquota criada com sucesso');
      setIsCreateOpen(false);
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('duplicate')) {
        toast.error('Já existe uma alíquota para esta combinação UF');
      } else {
        toast.error('Erro ao criar alíquota');
      }
    }
  };

  const handleUpdate = async (id: string, data: { rate_percent: number }) => {
    try {
      await updateRate.mutateAsync({ id, updates: data });
      toast.success('Alíquota atualizada');
      setEditingRate(null);
    } catch (error) {
      toast.error('Erro ao atualizar alíquota');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRate.mutateAsync(id);
      toast.success('Alíquota excluída');
    } catch (error) {
      toast.error('Erro ao excluir alíquota');
    }
  };

  const onDropIcms = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      const result = await parseIcmsFile(file);
      if (result.rows.length === 0) {
        toast.error('Nenhuma linha válida encontrada');
        return;
      }
      setImportParsedRows(result.rows);
      if (result.invalidRows > 0) {
        toast.warning(`${result.invalidRows} linha(s) inválida(s) serão ignoradas`);
      }
    } catch (error) {
      toast.error('Erro ao processar arquivo');
    }
  }, []);

  const {
    getRootProps: getIcmsRootProps,
    getInputProps: getIcmsInputProps,
    isDragActive: isIcmsDragActive,
  } = useDropzone({
    onDrop: onDropIcms,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handleImportIcms = async () => {
    const validRows = importParsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }

    setIsImporting(true);
    try {
      const result = await upsertRates.mutateAsync(
        validRows.map((r) => ({
          origin_state: r.origin_state,
          destination_state: r.destination_state,
          rate_percent: r.rate_percent,
        }))
      );

      // Show detailed result
      if (result.success) {
        toast.success(
          `Importação concluída: ${result.inserted} inseridas, ${result.updated} atualizadas`
        );
      } else {
        toast.warning(
          `Importação parcial: ${result.inserted} inseridas, ${result.updated} atualizadas, ${result.failed} com erro`,
          { duration: 6000 }
        );
        // Log first 5 errors
        result.errors.slice(0, 5).forEach((err) => {
          toast.error(err, { duration: 5000 });
        });
        if (result.errors.length > 5) {
          toast.info(`+ ${result.errors.length - 5} erros adicionais (ver console)`);
          console.error('[ICMS Import Errors]', result.errors);
        }
      }

      setIsImportOpen(false);
      setImportParsedRows([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao importar: ${msg}`);
      console.error('[ICMS Import]', error);
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Alíquotas de ICMS</CardTitle>
          <CardDescription>Gerencie as alíquotas por UF de origem e destino</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterOrigin} onValueChange={setFilterOrigin}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="UF Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {BRAZILIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog
            open={isImportOpen}
            onOpenChange={(open) => {
              setIsImportOpen(open);
              if (!open) setImportParsedRows([]);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Importar Alíquotas ICMS
                </DialogTitle>
                <DialogDescription>
                  Faça upload de um arquivo CSV com colunas: uf_origem, uf_destino, aliquota
                </DialogDescription>
              </DialogHeader>

              {importParsedRows.length === 0 ? (
                <div
                  {...getIcmsRootProps()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    isIcmsDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <input {...getIcmsInputProps()} />
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-foreground">
                    {isIcmsDragActive ? 'Solte aqui' : 'Arraste ou clique para selecionar'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">CSV com separador ;</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{importParsedRows.length} linhas</Badge>
                    <Badge variant="secondary">
                      {importParsedRows.filter((r) => r.isValid).length} válidas
                    </Badge>
                    {importParsedRows.filter((r) => !r.isValid).length > 0 && (
                      <Badge variant="destructive">
                        {importParsedRows.filter((r) => !r.isValid).length} inválidas
                      </Badge>
                    )}
                  </div>
                  <div className="max-h-48 overflow-auto border rounded text-sm">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Origem</th>
                          <th className="p-2 text-left">Destino</th>
                          <th className="p-2 text-left">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importParsedRows.slice(0, 20).map((row, idx) => (
                          <tr key={idx} className={cn(!row.isValid && 'bg-destructive/10')}>
                            <td className="p-2">{row.origin_state}</td>
                            <td className="p-2">{row.destination_state}</td>
                            <td className="p-2">{row.rate_percent}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importParsedRows.length > 20 && (
                      <p className="p-2 text-center text-muted-foreground bg-muted">
                        +{importParsedRows.length - 20} linhas
                      </p>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                {importParsedRows.length > 0 && (
                  <>
                    <Button variant="outline" onClick={() => setImportParsedRows([])}>
                      Limpar
                    </Button>
                    <Button onClick={handleImportIcms} disabled={isImporting}>
                      {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Importar {importParsedRows.filter((r) => r.isValid).length} alíquotas
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Alíquota
              </Button>
            </DialogTrigger>
            <DialogContent>
              <IcmsRateForm onSubmit={handleCreate} isLoading={createRate.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {filteredRates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhuma alíquota encontrada</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UF Origem</TableHead>
                <TableHead>UF Destino</TableHead>
                <TableHead>Alíquota (%)</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">{rate.origin_state}</TableCell>
                  <TableCell>{rate.destination_state}</TableCell>
                  <TableCell>{rate.rate_percent}%</TableCell>
                  <TableCell>
                    {rate.valid_from
                      ? `${format(new Date(rate.valid_from), 'dd/MM/yy')}${rate.valid_until ? ` - ${format(new Date(rate.valid_until), 'dd/MM/yy')}` : ''}`
                      : 'Indefinida'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Dialog
                        open={editingRate?.id === rate.id}
                        onOpenChange={(open) => !open && setEditingRate(null)}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditingRate(rate)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <IcmsRateForm
                            initialData={rate}
                            onSubmit={(data) => handleUpdate(rate.id, data)}
                            isLoading={updateRate.isPending}
                          />
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir alíquota?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A alíquota {rate.origin_state} →{' '}
                              {rate.destination_state} será excluída permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(rate.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

interface IcmsRateFormProps {
  initialData?: { origin_state: string; destination_state: string; rate_percent: number };
  onSubmit: (data: {
    origin_state: string;
    destination_state: string;
    rate_percent: number;
  }) => void;
  isLoading: boolean;
}

function IcmsRateForm({ initialData, onSubmit, isLoading }: IcmsRateFormProps) {
  const [originState, setOriginState] = useState(initialData?.origin_state || '');
  const [destinationState, setDestinationState] = useState(initialData?.destination_state || '');
  const [ratePercent, setRatePercent] = useState(initialData?.rate_percent?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialData && (!originState || !destinationState)) {
      toast.error('Selecione origem e destino');
      return;
    }
    if (!ratePercent || isNaN(Number(ratePercent))) {
      toast.error('Alíquota inválida');
      return;
    }
    onSubmit({
      origin_state: originState,
      destination_state: destinationState,
      rate_percent: Number(ratePercent),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Alíquota' : 'Nova Alíquota de ICMS'}</DialogTitle>
        <DialogDescription>
          {initialData
            ? `Atualize a alíquota para ${initialData.origin_state} → ${initialData.destination_state}`
            : 'Defina a alíquota de ICMS para a rota interestadual'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {!initialData && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>UF Origem</Label>
                <Select value={originState} onValueChange={setOriginState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>UF Destino</Label>
                <Select value={destinationState} onValueChange={setDestinationState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor="rate">Alíquota (%)</Label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={ratePercent}
            onChange={(e) => setRatePercent(e.target.value)}
            placeholder="Ex: 12"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {initialData ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
