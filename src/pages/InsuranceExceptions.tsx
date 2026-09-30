import { useMemo, useState } from 'react';
import { Download, FileCheck2, FileWarning, Mail, XCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  InsuranceExceptionDecisionDialog,
  InsuranceExceptionDialog,
} from '@/components/risk/InsuranceExceptionDialog';
import {
  EXCEPTION_STATUS_CLASS,
  EXCEPTION_STATUS_LABEL,
  formatDeadline,
  openExceptionFile,
} from '@/lib/insurance-exception-ui';
import {
  useDecideInsuranceException,
  useInsuranceExceptions,
  type InsuranceExceptionRequest,
} from '@/hooks/useInsuranceExceptions';
import { effectiveStatus, type EffectiveStatus } from '@/lib/insurance-exception';
import { brl } from '@/lib/ms-liberacao-prefill';

type FilterKey = 'abertos' | 'liberados' | 'todos';

const FILTERS: Record<FilterKey, (s: EffectiveStatus) => boolean> = {
  abertos: (s) => s === 'draft' || s === 'sent' || s === 'rejected',
  liberados: (s) => s === 'accepted' || s === 'tacit_accepted',
  todos: () => true,
};

/**
 * Seguro → Liberações: pedidos de liberação de embarque excepcional (MS/Fairfax).
 * CT-e e MDF-e de embarques acima do LMG só emitem com liberação aceita ou aceite tácito.
 */
export default function InsuranceExceptions() {
  const { data: requests = [], isLoading } = useInsuranceExceptions();
  const cancel = useDecideInsuranceException();
  const [filter, setFilter] = useState<FilterKey>('abertos');
  const [editing, setEditing] = useState<InsuranceExceptionRequest | null>(null);
  const [deciding, setDeciding] = useState<InsuranceExceptionRequest | null>(null);

  const now = useMemo(() => new Date(), [requests]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(
    () =>
      requests
        .map((r) => ({ r, st: effectiveStatus(r, now) }))
        .filter(({ st }) => FILTERS[filter](st)),
    [requests, filter, now]
  );
  const waiting = requests.filter((r) => effectiveStatus(r, now) === 'sent').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <FileWarning className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Liberações de embarque</h1>
              <p className="text-sm text-muted-foreground">
                Pedidos à MS/Fairfax para embarques acima do limite da apólice. Sem liberação
                vigente, CT-e e MDF-e ficam bloqueados.
              </p>
            </div>
          </div>
          {waiting > 0 && (
            <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
              {waiting} aguardando MS
            </Badge>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList>
            <TabsTrigger value="abertos">Em aberto</TabsTrigger>
            <TabsTrigger value="liberados">Liberados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Limite</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Prazo MS</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum pedido nesta visão. Pedidos são abertos na aba Risco da OS.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ r, st }) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge className={EXCEPTION_STATUS_CLASS[st]}>
                      {EXCEPTION_STATUS_LABEL[st]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.order?.os_number ?? '—'}</TableCell>
                  <TableCell>
                    {r.order?.client_name ?? r.form_data?.text?.destinatario ?? '—'}
                  </TableCell>
                  <TableCell>{r.vehicle_plate ?? '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {brl(Number(r.cargo_value))}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {r.applied_limit ? brl(Number(r.applied_limit)) : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDeadline(r.sent_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {st === 'sent' ? formatDeadline(r.response_deadline) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.docx_storage_path && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Formulário enviado"
                          onClick={() => openExceptionFile(r.docx_storage_path)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {r.response_storage_path && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Resposta da MS"
                          onClick={() => openExceptionFile(r.response_storage_path)}
                        >
                          <FileCheck2 className="h-4 w-4" />
                        </Button>
                      )}
                      {(st === 'draft' || st === 'sent') && r.order_id && (
                        <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                          <Mail className="h-4 w-4 mr-1" /> {st === 'draft' ? 'Enviar' : 'Reenviar'}
                        </Button>
                      )}
                      {st === 'sent' && (
                        <Button size="sm" onClick={() => setDeciding(r)}>
                          Resposta
                        </Button>
                      )}
                      {(st === 'draft' || st === 'sent') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Cancelar pedido"
                          disabled={cancel.isPending}
                          onClick={() => {
                            if (window.confirm('Cancelar este pedido de liberação?')) {
                              cancel.mutate({ id: r.id, decision: 'cancelled' });
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {editing?.order_id && (
        <InsuranceExceptionDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          orderId={editing.order_id}
          request={editing}
        />
      )}
      <InsuranceExceptionDecisionDialog
        open={deciding !== null}
        onOpenChange={(o) => !o && setDeciding(null)}
        request={deciding}
      />
    </MainLayout>
  );
}
