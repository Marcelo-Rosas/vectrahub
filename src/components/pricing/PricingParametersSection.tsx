import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import { usePricingParameters } from '@/hooks/usePricingRules';
import {
  useUpdatePricingParameter,
  useCreatePricingParameter,
  useDeletePricingParameter,
} from '@/hooks/usePricingMutations';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PricingParameter } from '@/types/pricing';

interface PricingParametersSectionProps {
  includeKeys?: string[];
  excludeKeys?: string[];
  title?: string;
}

export function PricingParametersSection({
  includeKeys,
  excludeKeys,
  title,
}: PricingParametersSectionProps = {}) {
  const { data: allParameters, isLoading } = usePricingParameters();

  const parameters = (allParameters ?? []).filter((p) => {
    if (includeKeys?.length) return includeKeys.includes(p.key);
    if (excludeKeys?.length) return !excludeKeys.includes(p.key);
    return true;
  });
  const updateMutation = useUpdatePricingParameter();
  const createMutation = useCreatePricingParameter();
  const deleteMutation = useDeletePricingParameter();

  const [editingParam, setEditingParam] = useState<PricingParameter | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const formatValue = (param: PricingParameter) => {
    if (param.unit === 'kg/m3') return `${param.value} kg/m³`;
    if (param.unit === 'BRL')
      return `R$ ${param.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (param.unit === '%') return `${param.value}%`;
    return param.value.toString();
  };

  const handleSave = async (id: string, value: number, description?: string) => {
    try {
      await updateMutation.mutateAsync({ id, updates: { value, description } });
      toast.success('Parâmetro atualizado');
      setEditingParam(null);
    } catch (error) {
      toast.error('Erro ao atualizar parâmetro');
    }
  };

  const handleCreate = async (data: {
    key: string;
    value: number;
    unit: string;
    description: string;
  }) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Parâmetro criado');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar parâmetro');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Parâmetro excluído');
    } catch (error) {
      toast.error('Erro ao excluir parâmetro');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Parâmetro
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chave</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parameters?.map((param) => (
            <TableRow key={param.id}>
              <TableCell className="font-mono text-sm">{param.key}</TableCell>
              <TableCell className="font-medium">{formatValue(param)}</TableCell>
              <TableCell className="text-muted-foreground">{param.description || '-'}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditingParam(param)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(param.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog open={!!editingParam} onOpenChange={(open) => !open && setEditingParam(null)}>
        <DialogContent>
          {editingParam && (
            <EditParameterForm
              param={editingParam}
              onSave={handleSave}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <CreateParameterForm onCreate={handleCreate} isLoading={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditParameterForm({
  param,
  onSave,
  isLoading,
}: {
  param: PricingParameter;
  onSave: (id: string, value: number, description?: string) => void;
  isLoading: boolean;
}) {
  const [value, setValue] = useState(param.value.toString());
  const [description, setDescription] = useState(param.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      toast.error('Valor inválido');
      return;
    }
    onSave(param.id, numValue, description);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Editar Parâmetro</DialogTitle>
        <DialogDescription>
          Atualize o valor do parâmetro <code className="bg-muted px-1 rounded">{param.key}</code>
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Valor ({param.unit || 'numérico'})</Label>
          <Input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição do parâmetro"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreateParameterForm({
  onCreate,
  isLoading,
}: {
  onCreate: (data: { key: string; value: number; unit: string; description: string }) => void;
  isLoading: boolean;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      toast.error('Chave é obrigatória');
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      toast.error('Valor inválido');
      return;
    }
    onCreate({ key, value: numValue, unit, description });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Novo Parâmetro</DialogTitle>
        <DialogDescription>Adicione um novo parâmetro de precificação</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Chave</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ex: min_freight"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="ex: kg/m3, BRL, %"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição do parâmetro"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Criar
        </Button>
      </DialogFooter>
    </form>
  );
}
