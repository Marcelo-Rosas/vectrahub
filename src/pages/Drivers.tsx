import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Loader2, User, Phone } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDrivers, useDeleteDriver } from '@/hooks/useDrivers';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { DriverForm } from '@/components/forms/DriverForm';
import type { Driver } from '@/hooks/useDrivers';
import { useDebounce } from '@/hooks/useDebounce';
import { Badge } from '@/components/ui/badge';
import { DriverContractBadge } from '@/components/drivers/DriverContractBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Drivers() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: drivers, isLoading, isError, error, refetch } = useDrivers(false);
  const deleteDriverMutation = useDeleteDriver();

  const filteredDrivers = debouncedSearchTerm
    ? drivers?.filter(
        (d) =>
          d.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (d.phone && d.phone.includes(debouncedSearchTerm)) ||
          (d.cpf && d.cpf.replace(/\D/g, '').includes(debouncedSearchTerm.replace(/\D/g, ''))) ||
          (d.antt && d.antt.replace(/\D/g, '').includes(debouncedSearchTerm.replace(/\D/g, '')))
      )
    : drivers;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canManageDrivers = canWrite;

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!canManageDrivers || !deletingDriver || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDriverMutation.mutateAsync(deletingDriver.id);
      toast.success('Motorista excluído com sucesso');
      setDeletingDriver(null);
    } catch {
      toast.error('Erro ao excluir motorista');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingDriver(null);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar os motoristas</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Motoristas
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="font-semibold text-primary">{filteredDrivers?.length || 0}</span>{' '}
            motoristas cadastrados
          </motion.p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, telefone, CPF ou RNTRC..."
              className="pl-10 w-80"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canManageDrivers && (
            <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Motorista
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-8">
          <p className="text-foreground font-medium">Não foi possível carregar os motoristas</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) || 'Erro inesperado ao buscar motoristas.'}
          </p>
          <div className="mt-4">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : filteredDrivers?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-card p-12 text-center"
        >
          <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum motorista cadastrado
          </h3>
          <p className="text-muted-foreground mb-4">
            Cadastre motoristas para usar em veículos e OS
          </p>
          {canManageDrivers && (
            <Button onClick={() => setIsFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Motorista
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Motorista
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Vínculo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    CPF / RNTRC
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Telefone
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDrivers?.map((driver) => (
                  <tr key={driver.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{driver.name}</span>
                          {!driver.active && (
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-xs w-fit">
                          {driver.contract_type === 'agregado'
                            ? 'Agregado'
                            : driver.contract_type === 'terceiro'
                              ? 'Terceiro'
                              : 'Frota'}
                        </Badge>
                        <DriverContractBadge
                          contractType={
                            driver.contract_type as 'proprio' | 'agregado' | 'terceiro' | null
                          }
                          rntrcRegistryType={
                            (driver.rntrc_registry_type as 'TAC' | 'ETC' | null | undefined) ?? null
                          }
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-sm font-mono text-foreground">
                        <span>{driver.cpf || '—'}</span>
                        <span className="text-muted-foreground">{driver.antt || 'sem RNTRC'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {driver.phone ? (
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          {driver.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canManageDrivers && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(driver)}
                              aria-label="Editar motorista"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingDriver(driver)}
                              aria-label="Excluir motorista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <DriverForm
        open={isFormOpen && canManageDrivers}
        onClose={handleFormClose}
        driver={editingDriver}
      />

      <AlertDialog
        open={!!deletingDriver && canManageDrivers}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingDriver(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motorista?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o motorista &quot;{deletingDriver?.name}&quot;? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
