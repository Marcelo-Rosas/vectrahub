import { useState, useMemo, useEffect } from 'react';
import {
  DollarSign,
  Save,
  Loader2,
  Send,
  TrendingDown,
  TrendingUp,
  Truck,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MaskedInput } from '@/components/ui/masked-input';
import { DatePickerString } from '@/components/ui/date-picker';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { CarrierPaymentProofList } from '@/components/documents/CarrierPaymentProofList';
import { useUpdateOrder } from '@/hooks/useOrders';
import { usePaymentTerms } from '@/hooks/usePricingRules';
import { useEnsureFinancialDocument } from '@/hooks/useEnsureFinancialDocument';
import { useTripsForOrder } from '@/hooks/useTrips';
import { useOrderReconciliation } from '@/hooks/useReconciliation';
import { useProcessPaymentProof } from '@/hooks/usePaymentProofs';
import { supabase } from '@/integrations/supabase/client';
import { asInsert } from '@/lib/supabase-utils';
import { isCarreteiroRealBelowFloor } from '@/lib/carreteiro-cost';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { OrderWithOccurrences } from '@/hooks/useOrders';

interface CarreteiroTabProps {
  order: OrderWithOccurrences;
  canManage: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export function CarreteiroTab({ order, canManage }: CarreteiroTabProps) {
  const updateOrderMutation = useUpdateOrder();
  const ensureFinancialDocMutation = useEnsureFinancialDocument();
  const { data: paymentTermsList } = usePaymentTerms(true);
  const { data: trip } = useTripsForOrder(order.id);
  const { data: reconciliation } = useOrderReconciliation(order.id);
  const processPaymentProofMutation = useProcessPaymentProof();

  const handleCarrierPaymentDocCreated = (documentId: string) => {
    processPaymentProofMutation.mutate(documentId, { onError: () => {} });
  };

  // ---------- Valor Negociado ----------
  const initialCents =
    order.carreteiro_real != null ? String(Math.round(Number(order.carreteiro_real) * 100)) : '';
  const [carreteiroRealCents, setCarreteiroRealCents] = useState(initialCents);

  useEffect(() => {
    const cents =
      order.carreteiro_real != null ? String(Math.round(Number(order.carreteiro_real) * 100)) : '';
    setCarreteiroRealCents(cents);
  }, [order.carreteiro_real]);

  const carreteiroRealValue =
    carreteiroRealCents.length > 0 ? Number(carreteiroRealCents) / 100 : null;

  const anttValue = order.carreteiro_antt != null ? Number(order.carreteiro_antt) : null;

  // Custos reais (pedagio, descarga)
  const pedagioPrevisto =
    order.pricing_breakdown &&
    typeof order.pricing_breakdown === 'object' &&
    'components' in order.pricing_breakdown
      ? Number(
          (order.pricing_breakdown as { components?: { toll?: unknown } }).components?.toll ?? 0
        )
      : 0;
  const descargaPrevisto =
    order.pricing_breakdown &&
    typeof order.pricing_breakdown === 'object' &&
    'profitability' in order.pricing_breakdown
      ? Number(
          (order.pricing_breakdown as { profitability?: { custosDescarga?: unknown } })
            .profitability?.custosDescarga ?? 0
        )
      : 0;
  const [pedagioRealCents, setPedagioRealCents] = useState(
    order.pedagio_real != null ? String(Math.round(Number(order.pedagio_real) * 100)) : ''
  );
  const [descargaRealCents, setDescargaRealCents] = useState(
    order.descarga_real != null ? String(Math.round(Number(order.descarga_real) * 100)) : ''
  );

  useEffect(() => {
    setPedagioRealCents(
      order.pedagio_real != null ? String(Math.round(Number(order.pedagio_real) * 100)) : ''
    );
    setDescargaRealCents(
      order.descarga_real != null ? String(Math.round(Number(order.descarga_real) * 100)) : ''
    );
  }, [order.pedagio_real, order.descarga_real]);
  const kmDistance = Number(order.km_distance ?? 0);

  const diff =
    carreteiroRealValue != null && anttValue != null ? carreteiroRealValue - anttValue : null;

  const belowFloor = isCarreteiroRealBelowFloor(carreteiroRealValue, anttValue);

  const handleSaveCarreteiroReal = async () => {
    if (carreteiroRealValue == null) {
      toast.error('Informe o valor do carreteiro');
      return;
    }
    if (isCarreteiroRealBelowFloor(carreteiroRealValue, anttValue)) {
      toast.error(
        `Valor negociado abaixo do piso ANTT (${formatCurrency(anttValue!)}). Negocie ≥ piso.`
      );
      return;
    }
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { carreteiro_real: carreteiroRealValue },
      });
      toast.success('Valor do carreteiro salvo');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar valor do carreteiro';
      toast.error(msg);
    }
  };

  const handleSaveCustosReais = async () => {
    const pedagioReal = pedagioRealCents.length > 0 ? Number(pedagioRealCents) / 100 : null;
    const descargaReal = descargaRealCents.length > 0 ? Number(descargaRealCents) / 100 : null;
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { pedagio_real: pedagioReal, descarga_real: descargaReal },
      });
      toast.success('Custos reais salvos');
    } catch {
      toast.error('Erro ao salvar custos reais');
    }
  };

  // ---------- Condição de Pagamento ----------
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState(
    order.carrier_payment_term_id ?? ''
  );

  useEffect(() => {
    setSelectedPaymentTermId(order.carrier_payment_term_id ?? '');
  }, [order.carrier_payment_term_id]);

  const selectedPaymentTerm = useMemo(() => {
    if (!paymentTermsList || !selectedPaymentTermId) return null;
    return paymentTermsList.find((pt) => pt.id === selectedPaymentTermId) ?? null;
  }, [paymentTermsList, selectedPaymentTermId]);

  const advancePercent = selectedPaymentTerm?.advance_percent ?? 0;
  const balancePercent = 100 - advancePercent;
  const baseValue = carreteiroRealValue ?? anttValue ?? 0;
  const advanceAmount = (baseValue * advancePercent) / 100;
  const balanceAmount = (baseValue * balancePercent) / 100;

  const handleSavePaymentTerm = async (ptId: string) => {
    setSelectedPaymentTermId(ptId);
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { carrier_payment_term_id: ptId || null },
      });
      toast.success('Condição de pagamento salva');
    } catch {
      toast.error('Erro ao salvar condição de pagamento');
    }
  };

  // ---------- Datas ----------
  const [advanceDate, setAdvanceDate] = useState(order.carrier_advance_date ?? '');
  const [balanceDate, setBalanceDate] = useState(order.carrier_balance_date ?? '');

  useEffect(() => {
    setAdvanceDate(order.carrier_advance_date ?? '');
    setBalanceDate(order.carrier_balance_date ?? '');
  }, [order.carrier_advance_date, order.carrier_balance_date]);

  const handleSaveDate = async (
    field: 'carrier_advance_date' | 'carrier_balance_date',
    value: string
  ) => {
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { [field]: value || null },
      });
      toast.success('Data salva');
    } catch {
      toast.error('Erro ao salvar data');
    }
  };

  // ---------- Enviar para PAG ----------
  const handleEnviarParaPAG = async () => {
    if (!order.id) return;
    if (carreteiroRealValue == null || carreteiroRealValue <= 0) {
      toast.error('Informe o valor do carreteiro antes de enviar para o financeiro');
      return;
    }

    try {
      await ensureFinancialDocMutation.mutateAsync({
        docType: 'PAG',
        sourceId: order.id,
        totalAmount: carreteiroRealValue,
      });

      const { data: finDoc, error: finDocError } = await supabase
        .from('financial_documents')
        .select('id')
        .eq('source_id', order.id)
        .eq('type', 'PAG')
        .maybeSingle();

      if (finDocError || !finDoc?.id) {
        console.error('[handleEnviarParaPAG] Falha ao buscar PAG após criação:', finDocError);
        toast.error(
          'PAG criado, mas não foi possível buscar o documento para criar parcelas. Verifique no Financeiro.'
        );
        return;
      }

      if (finDoc?.id) {
        const { data: existingInstallments } = await supabase
          .from('financial_installments')
          .select('id')
          .eq('financial_document_id', finDoc.id);

        if (!existingInstallments || existingInstallments.length === 0) {
          if (advancePercent > 0) {
            const installments = [
              {
                financial_document_id: finDoc.id,
                amount: advanceAmount,
                due_date: advanceDate || new Date().toISOString().slice(0, 10),
                payment_method: `Adiantamento ${advancePercent}%`,
                status: 'pendente' as const,
              },
              {
                financial_document_id: finDoc.id,
                amount: balanceAmount,
                due_date: balanceDate || new Date().toISOString().slice(0, 10),
                payment_method: `Saldo ${balancePercent}%`,
                status: 'pendente' as const,
              },
            ];

            const { error: insError } = await supabase
              .from('financial_installments')
              .insert(installments.map(asInsert));

            if (insError) {
              console.error('Error inserting installments:', insError);
              toast.error('PAG criado, mas erro ao criar parcelas: ' + insError.message);
              return;
            }
          } else {
            const { error: insError } = await supabase.from('financial_installments').insert(
              asInsert({
                financial_document_id: finDoc.id,
                amount: carreteiroRealValue,
                due_date: balanceDate || advanceDate || new Date().toISOString().slice(0, 10),
                payment_method: 'Pagamento Único',
                status: 'pendente' as const,
              })
            );

            if (insError) {
              console.error('Error inserting installment:', insError);
              toast.error('PAG criado, mas erro ao criar parcela: ' + insError.message);
              return;
            }
          }
        }
      }

      toast.success('PAG enviado para Contas a Pagar com parcelas');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erro ao enviar para PAG';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5 py-1">
      {/* ── Piso ANTT (read-only, exatamente como na aba Detalhes) ── */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Piso ANTT (base)</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Valor ANTT</p>
            <p className="text-lg font-bold text-foreground">
              {anttValue != null ? formatCurrency(anttValue) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Real (fechado)</p>
            <p className="text-lg font-bold text-foreground">
              {order.carreteiro_real != null ? formatCurrency(Number(order.carreteiro_real)) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Diferença</p>
            {diff != null ? (
              <div className="flex items-center gap-1">
                {diff < 0 ? (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                ) : diff > 0 ? (
                  <TrendingUp className="w-4 h-4 text-warning-foreground" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                )}
                <p
                  className={cn(
                    'text-lg font-bold',
                    diff < 0
                      ? 'text-destructive'
                      : diff > 0
                        ? 'text-warning-foreground'
                        : 'text-success'
                  )}
                >
                  {formatCurrency(Math.abs(diff))}
                </p>
              </div>
            ) : (
              <p className="text-lg font-bold text-foreground">—</p>
            )}
          </div>
        </div>

        {kmDistance > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
              Custo R$/km
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">ANTT R$/km</p>
                <p className="font-semibold text-foreground">
                  {anttValue != null
                    ? `R$ ${(anttValue / kmDistance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Real R$/km</p>
                {order.carreteiro_real != null ? (
                  <p
                    className={cn(
                      'font-semibold',
                      anttValue != null && Number(order.carreteiro_real) < anttValue
                        ? 'text-destructive'
                        : anttValue != null && Number(order.carreteiro_real) > anttValue
                          ? 'text-warning-foreground'
                          : 'text-success'
                    )}
                  >
                    R${' '}
                    {(Number(order.carreteiro_real) / kmDistance).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    /km
                  </p>
                ) : (
                  <p className="font-semibold text-foreground">—</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Valor Negociado (editável) ── */}
      {canManage && (
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-sm font-semibold text-foreground mb-3">Editar Valor Negociado</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">
                Valor Carreteiro Real (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  R$
                </span>
                <MaskedInput
                  mask="currency"
                  value={carreteiroRealCents}
                  onValueChange={(rawValue) => setCarreteiroRealCents(rawValue)}
                  placeholder="0,00"
                  className={cn(
                    'h-10 pl-10',
                    belowFloor && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
              </div>
              {belowFloor && anttValue != null && (
                <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Abaixo do piso ANTT ({formatCurrency(anttValue)}). Salvar bloqueado.
                </p>
              )}
            </div>
            <Button
              size="default"
              onClick={handleSaveCarreteiroReal}
              disabled={updateOrderMutation.isPending || belowFloor || carreteiroRealValue == null}
              className="gap-2 h-10"
            >
              {updateOrderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* ── Custos reais (pedágio, descarga) ── */}
      {(pedagioPrevisto > 0 || descargaPrevisto > 0 || canManage) && (
        <div className="p-4 rounded-lg border border-border bg-muted/20">
          <p className="text-sm font-semibold text-foreground mb-3">
            Custos reais (previsto vs real)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pedagioPrevisto > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pedágio</p>
                <p className="text-sm">
                  Previsto: {formatCurrency(pedagioPrevisto)}
                  {order.pedagio_real != null && (
                    <span className="ml-2 font-medium">
                      Real: {formatCurrency(Number(order.pedagio_real))}
                    </span>
                  )}
                </p>
              </div>
            )}
            {descargaPrevisto > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Descarga</p>
                <p className="text-sm">
                  Previsto: {formatCurrency(descargaPrevisto)}
                  {order.descarga_real != null && (
                    <span className="ml-2 font-medium">
                      Real: {formatCurrency(Number(order.descarga_real))}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          {canManage && (
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <label className="text-xs text-muted-foreground block mb-1">
                  Pedágio real (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <MaskedInput
                    mask="currency"
                    value={pedagioRealCents}
                    onValueChange={(v) => setPedagioRealCents(v)}
                    placeholder="0,00"
                    className="h-9 pl-9"
                  />
                </div>
              </div>
              <div className="min-w-[140px]">
                <label className="text-xs text-muted-foreground block mb-1">
                  Descarga real (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <MaskedInput
                    mask="currency"
                    value={descargaRealCents}
                    onValueChange={(v) => setDescargaRealCents(v)}
                    placeholder="0,00"
                    className="h-9 pl-9"
                  />
                </div>
              </div>
              <Button
                size="default"
                onClick={handleSaveCustosReais}
                disabled={updateOrderMutation.isPending}
                className="gap-2 h-9"
              >
                {updateOrderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar
              </Button>
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* ── Condição de Pagamento do Carreteiro ── */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">
          Condição de Pagamento (Carreteiro)
        </p>
        <Select
          value={selectedPaymentTermId}
          onValueChange={handleSavePaymentTerm}
          disabled={!canManage}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione a condição de pagamento" />
          </SelectTrigger>
          <SelectContent>
            {paymentTermsList?.map((pt) => (
              <SelectItem key={pt.id} value={pt.id}>
                {pt.name} — {pt.advance_percent ?? 0}% adiantamento / {pt.days ?? 0} dias
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPaymentTerm && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {selectedPaymentTerm.advance_percent != null && selectedPaymentTerm.advance_percent > 0
              ? `${selectedPaymentTerm.advance_percent}% Adiantamento / ${100 - selectedPaymentTerm.advance_percent}% Saldo em ${selectedPaymentTerm.days ?? 0} dias`
              : `Pagamento à vista em ${selectedPaymentTerm.days ?? 0} dias`}
          </p>
        )}
      </div>

      {/* ── Mini-cards Adiantamento / Saldo ── */}
      {selectedPaymentTerm && advancePercent > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Adiantamento */}
          <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Adiantamento {advancePercent}%
            </p>
            <p className="text-xl font-bold text-foreground mb-3">
              {formatCurrency(advanceAmount)}
            </p>
            <label className="text-xs text-muted-foreground block mb-1">Data</label>
            <DatePickerString
              value={advanceDate}
              onChange={(val) => {
                setAdvanceDate(val);
                handleSaveDate('carrier_advance_date', val);
              }}
              disabled={!canManage}
            />
          </div>

          {/* Saldo */}
          <div className="p-4 rounded-lg border bg-muted/30 border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Saldo {balancePercent}%
            </p>
            <p className="text-xl font-bold text-foreground mb-3">
              {formatCurrency(balanceAmount)}
            </p>
            <label className="text-xs text-muted-foreground block mb-1">Data</label>
            <DatePickerString
              value={balanceDate}
              onChange={(val) => {
                setBalanceDate(val);
                handleSaveDate('carrier_balance_date', val);
              }}
              disabled={!canManage}
            />
          </div>
        </div>
      )}

      {/* Pagamento único (sem split) */}
      {selectedPaymentTerm && advancePercent === 0 && (
        <div className="p-4 rounded-lg border bg-muted/30 border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">
                Pagamento Único (100%)
              </p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(baseValue)}</p>
            </div>
            <div className="w-48">
              <label className="text-xs text-muted-foreground block mb-1">Data de Pagamento</label>
              <DatePickerString
                value={balanceDate}
                onChange={(val) => {
                  setBalanceDate(val);
                  handleSaveDate('carrier_balance_date', val);
                }}
                disabled={!canManage}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Enviar para Contas a Pagar ── */}
      {canManage && (
        <>
          <Separator />
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleEnviarParaPAG}
              disabled={ensureFinancialDocMutation.isPending || carreteiroRealValue == null}
              className="gap-2"
            >
              {ensureFinancialDocMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar para Contas a Pagar
            </Button>
          </div>
        </>
      )}

      {/* ── Badge Trip + Resumo Conciliação ── */}
      {(trip || reconciliation) && (
        <>
          <Separator />
          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
            {trip && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Trip</span>
                <span className="font-mono text-sm">{trip.trip_number}</span>
              </div>
            )}
            {reconciliation && Number(reconciliation.expected_amount) > 0 && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Esperado</p>
                  <p className="font-semibold">{formatCurrency(reconciliation.expected_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pago</p>
                  <p className="font-semibold">{formatCurrency(reconciliation.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Delta</p>
                  <p
                    className={cn(
                      'font-semibold',
                      reconciliation.is_reconciled ? 'text-success' : 'text-warning-foreground'
                    )}
                  >
                    {formatCurrency(reconciliation.delta_amount)}
                  </p>
                </div>
              </div>
            )}
            {reconciliation && (
              <div className="flex items-center gap-2">
                {reconciliation.is_reconciled ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Conciliado
                  </span>
                ) : reconciliation.proofs_count > 0 &&
                  reconciliation.paid_amount === 0 &&
                  Number(reconciliation.expected_amount) > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Pendente confirmação
                  </span>
                ) : reconciliation.proofs_count > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <XCircle className="w-3.5 h-3.5" />
                    Divergente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Pendente
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Comprovantes de Pagamento ── */}
      <Separator />
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Comprovantes de Pagamento</p>
        <DocumentUpload
          orderId={order.id}
          orderStage={order.stage}
          financialContext="carrier_payment"
          allowComprovanteDescarga={Number(order.descarga_real ?? 0) > 0}
          onCarrierPaymentDocCreated={handleCarrierPaymentDocCreated}
        />
        <div className="mt-4">
          <CarrierPaymentProofList orderId={order.id} />
        </div>
      </div>
    </div>
  );
}
