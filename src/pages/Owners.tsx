import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOwners, useDeleteOwner } from '@/hooks/useOwners';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { OwnerForm } from '@/components/forms/OwnerForm';
import { Database } from '@/integrations/supabase/types';
import { useDebounce } from '@/hooks/useDebounce';
import { Badge } from '@/components/ui/badge';
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

type Owner = Database['public']['Tables']['owners']['Row'];

/** Colunas ANTT/MDF-e (podem ainda não estar nos tipos gerados). */
type OwnerAnttCols = {
  rntrc?: string | null;
  uf?: string | null;
  tipo_proprietario?: number | null;
};

const TIPO_PROP_LABEL: Record<number, string> = {
  0: 'TAC Agreg.',
  1: 'TAC Indep.',
  2: 'Outros',
};

export default function Owners() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const {
    data: owners,
    isLoading,
    isError,
    error,
    refetch,
  } = useOwners(debouncedSearchTerm, { enabled: !!user });
  const deleteOwnerMutation = useDeleteOwner();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [deletingOwner, setDeletingOwner] = useState<Owner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canManageOwners = canWrite;

  const handleEdit = (owner: Owner) => {
    setEditingOwner(owner);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!canManageOwners) return;
    if (!deletingOwner || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteOwnerMutation.mutateAsync(deletingOwner.id);
      toast.success('Proprietário excluído com sucesso');
      setDeletingOwner(null);
    } catch {
      toast.error('Erro ao excluir proprietário');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingOwner(null);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar os proprietários</p>
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
            Proprietários
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="font-semibold text-primary">{owners?.length || 0}</span> proprietários
            cadastrados
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ, e-mail..."
              className="pl-10 w-80"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canManageOwners && (
            <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Proprietário
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
          <p className="text-foreground font-medium">Não foi possível carregar os proprietários</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) ||
              'Erro inesperado ao buscar proprietários.'}
          </p>
          <div className="mt-4">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : owners?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-card p-12 text-center"
        >
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum proprietário cadastrado
          </h3>
          <p className="text-muted-foreground mb-4">Comece adicionando seu primeiro proprietário</p>
          {canManageOwners && (
            <Button onClick={() => setIsFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Proprietário
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
                    Proprietário
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    CPF/CNPJ
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Localização
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    ANTT / MDF-e
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {owners?.map((owner) => {
                  const antt = owner as Owner & OwnerAnttCols;
                  const tipoLabel =
                    antt.tipo_proprietario != null
                      ? (TIPO_PROP_LABEL[antt.tipo_proprietario] ??
                        `Tipo ${antt.tipo_proprietario}`)
                      : null;
                  return (
                    <tr key={owner.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{owner.name}</p>
                              {!owner.active && (
                                <Badge variant="secondary" className="text-xs">
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            {owner.notes && (
                              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {owner.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono text-sm">
                        {owner.cpf_cnpj || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {owner.phone && (
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              {owner.phone}
                            </div>
                          )}
                          {owner.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              {owner.email}
                            </div>
                          )}
                          {!owner.phone && !owner.email && '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {owner.city || owner.state ? (
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            {[owner.city, owner.state].filter(Boolean).join(' - ')}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {antt.rntrc || antt.uf || tipoLabel ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {antt.rntrc && (
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {antt.rntrc}
                              </Badge>
                            )}
                            {antt.uf && (
                              <Badge variant="secondary" className="text-[10px]">
                                UF {antt.uf}
                              </Badge>
                            )}
                            {tipoLabel && (
                              <Badge variant="secondary" className="text-[10px]">
                                {tipoLabel}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canManageOwners && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(owner)}
                                aria-label="Editar proprietário"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeletingOwner(owner)}
                                aria-label="Excluir proprietário"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <OwnerForm
        open={isFormOpen && canManageOwners}
        onClose={handleFormClose}
        owner={editingOwner}
      />

      <AlertDialog
        open={!!deletingOwner && canManageOwners}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingOwner(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proprietário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o proprietário &quot;{deletingOwner?.name}&quot;? Esta
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
