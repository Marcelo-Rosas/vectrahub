import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Mail, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActivePolicies } from '@/hooks/useRiskPolicies';
import {
  useDecideInsuranceException,
  useSaveInsuranceException,
  useSendInsuranceException,
  type InsuranceExceptionRequest,
} from '@/hooks/useInsuranceExceptions';
import {
  AVERBA_MS_CC_DEFAULT,
  AVERBA_MS_TO_DEFAULT,
  formatEmailList,
  parseEmailList,
} from '@/lib/averba-ms';
import { checkCoverageLimit, pickReferencePolicy } from '@/lib/insurance-limit';
import {
  MS_CHECK_GROUPS,
  MS_TEXT_LABELS,
  validateMsForm,
  type MsCheckGroup,
  type MsCheckKey,
  type MsLiberacaoForm,
  type MsTextKey,
} from '@/lib/ms-liberacao-form';
import { brl, buildMsFormPrefill, type DriverContract } from '@/lib/ms-liberacao-prefill';

const CHECK_LABELS: Record<MsCheckKey, string> = {
  apolice_tn: 'TN',
  apolice_rctr_vi: 'RCTR-VI',
  apolice_rctr_c: 'RCTR-C',
  apolice_rcf_dc: 'RCF-DC',
  apolice_ti_imp: 'TI-IMP',
  apolice_ti_exp: 'TI-EXP',
  apolice_rcta_c: 'RCTA-C',
  motivo_limite: 'Limite de garantia excedido',
  motivo_excluida: 'Mercadoria excluída',
  motivo_sem_gr: 'Sem gerenciamento de risco',
  motivo_gr_desacordo: 'GR em desacordo',
  motivo_rastreador: 'Problema com o rastreador',
  modal_rodoviario: 'Rodoviário',
  modal_aereo: 'Aéreo',
  modal_maritimo: 'Marítimo',
  modal_rodo_aereo: 'Rodo-aéreo',
  modal_rodo_fluvial: 'Rodo-fluvial',
  modal_cabotagem: 'Cabotagem',
  modal_ferroviario: 'Ferroviário',
  veiculo_frotista: 'Frotista',
  veiculo_agregado: 'Agregado',
  veiculo_terceiro: 'Terceiro',
  tipo_caminhao: 'Caminhão',
  tipo_utilitario: 'Utilitário',
  tipo_passeio: 'Veículo de passeio',
  tipo_moto: 'Moto',
  motorista_frotista: 'Frotista',
  motorista_agregado: 'Agregado',
  motorista_terceiro: 'Terceiro',
  rastreio_gprs: 'GPRS',
  rastreio_satelital: 'Satelital',
  rastreio_hibrido: 'Híbrido',
  rastreio_rf: 'Radiofrequência',
  tec2_localizador: 'Localizador',
  tec2_isca: 'Isca de carga',
  escolta_sim: 'Sim',
  escolta_nao: 'Não',
};

const GROUP_LABELS: Record<MsCheckGroup, string> = {
  apolice: 'Apólice',
  motivo: 'Motivo da solicitação',
  modal: 'Meio de transporte',
  veiculo: 'Veículo',
  tipo_veiculo: 'Tipo de veículo',
  motorista: 'Motorista',
  rastreio: 'Sistema de rastreamento',
  tec2: 'O veículo possui 2ª tecnologia?',
  escolta: 'Escolta armada',
};

/** Grupos de escolha única (marcar um desmarca os outros). */
const SINGLE_CHOICE: MsCheckGroup[] = ['veiculo', 'tipo_veiculo', 'motorista', 'escolta'];

const SECTIONS: { title: string; text: MsTextKey[]; groups: MsCheckGroup[] }[] = [
  {
    title: 'Dados do segurado / apólice',
    text: ['segurado_nome', 'apolice_numero_1', 'apolice_numero_2', 'lmg', 'sublimite'],
    groups: ['apolice'],
  },
  { title: 'Motivo', text: ['motivo_esclarecer'], groups: ['motivo'] },
  {
    title: 'Dados do embarque',
    text: [
      'mercadoria_tipo',
      'mercadoria_valor',
      'embarcador',
      'destinatario',
      'notas_fiscais',
      'conhecimento',
      'origem',
      'destino',
      'mercadoria_usada',
      'container',
      'percurso_fluvial',
      'previsao_inicio',
      'transportadora',
      'placa',
    ],
    groups: ['modal'],
  },
  {
    title: 'Gerenciamento de risco',
    text: ['terceiro_viagens_12m', 'rastreador_modelo', 'escolta_qtd', 'gerenciadora'],
    groups: ['veiculo', 'tipo_veiculo', 'motorista', 'rastreio', 'tec2', 'escolta'],
  },
  { title: 'Informações adicionais', text: ['info_adicionais'], groups: [] },
];

const MULTILINE: MsTextKey[] = ['motivo_esclarecer', 'info_adicionais', 'mercadoria_tipo'];

type OrderForException = {
  id: string;
  quote_id: string | null;
  trip_id: string | null;
  origin: string | null;
  destination: string | null;
  cargo_type: string | null;
  cargo_value: number | null;
  shipper_name: string | null;
  client_name: string | null;
  quote: {
    id: string;
    cargo_value: number | null;
    cargo_type: string | null;
    origin_ibge: number | null;
    destination_ibge: number | null;
    origin_uf: string | null;
    destination_uf: string | null;
    nfe_keys: string[] | null;
    shipper_name: string | null;
    client_name: string | null;
  } | null;
};

export interface InsuranceExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  request?: InsuranceExceptionRequest | null;
  vehiclePlate?: string | null;
  vehicleTypeName?: string | null;
  driverContract?: DriverContract;
}

function useOrderForException(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['insurance-exception-order', orderId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `id, quote_id, trip_id, origin, destination, cargo_type, cargo_value, shipper_name, client_name,
           quote:quotes (id, cargo_value, cargo_type, origin_ibge, destination_ibge, origin_uf, destination_uf,
             nfe_keys, shipper_name, client_name)`
        )
        .eq('id', orderId)
        .single();
      if (error) throw error;
      const order = data as unknown as OrderForException;

      // Viagem (VG) = mesmo veículo: soma valores e junta cotações (mesma regra do emit-cte).
      let tripQuoteIds: string[] = order.quote_id ? [order.quote_id] : [];
      let tripValue = Number(order.cargo_value ?? order.quote?.cargo_value ?? 0);
      if (order.trip_id) {
        const { data: tripOrders } = await supabase
          .from('orders')
          .select('quote_id, cargo_value')
          .eq('trip_id', order.trip_id);
        if (tripOrders?.length) {
          tripValue = tripOrders.reduce((s, o) => s + Number(o.cargo_value ?? 0), 0);
          tripQuoteIds = tripOrders.map((o) => o.quote_id).filter((q): q is string => !!q);
        }
      }
      return { order, tripQuoteIds, tripValue };
    },
  });
}

export function InsuranceExceptionDialog({
  open,
  onOpenChange,
  orderId,
  request,
  vehiclePlate,
  vehicleTypeName,
  driverContract,
}: InsuranceExceptionDialogProps) {
  const { data: policies = [] } = useActivePolicies();
  const { data: loaded, isLoading } = useOrderForException(orderId, open);
  const save = useSaveInsuranceException();
  const send = useSendInsuranceException();

  const [form, setForm] = useState<MsLiberacaoForm | null>(null);
  /** Rascunho já gravado nesta abertura: reenvio após falha atualiza em vez de duplicar. */
  const [savedId, setSavedId] = useState<string | null>(null);
  const [plannedStart, setPlannedStart] = useState('');
  const [to, setTo] = useState(formatEmailList(AVERBA_MS_TO_DEFAULT));
  const [cc, setCc] = useState(formatEmailList(AVERBA_MS_CC_DEFAULT));
  const [message, setMessage] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const refPolicy = useMemo(() => pickReferencePolicy(policies), [policies]);
  const check = useMemo(() => {
    if (!loaded || !refPolicy) return null;
    const { order } = loaded;
    return checkCoverageLimit(refPolicy, loaded.tripValue, {
      cargoType: order.cargo_type ?? order.quote?.cargo_type,
      originIbge: order.quote?.origin_ibge,
      destinationIbge: order.quote?.destination_ibge,
      originUf: order.quote?.origin_uf,
      destinationUf: order.quote?.destination_uf,
    });
  }, [loaded, refPolicy]);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setShowErrors(false);
      setSavedId(null);
      setMessage('');
      return;
    }
    if (form) return;
    if (request) {
      setForm(request.form_data);
      setPlannedStart(request.planned_start_at?.slice(0, 10) ?? '');
      if (request.email_to?.length) setTo(formatEmailList(request.email_to));
      if (request.email_cc?.length) setCc(formatEmailList(request.email_cc));
      return;
    }
    if (loaded && check) {
      const { order } = loaded;
      setForm(
        buildMsFormPrefill({
          policies,
          check,
          cargoType: order.cargo_type ?? order.quote?.cargo_type,
          shipperName: order.quote?.shipper_name ?? order.shipper_name,
          consigneeName: order.quote?.client_name ?? order.client_name,
          nfeKeys: order.quote?.nfe_keys,
          origin: order.origin,
          destination: order.destination,
          vehiclePlate,
          vehicleTypeName,
          driverContract,
        })
      );
    }
  }, [open, form, request, loaded, check, policies, vehiclePlate, vehicleTypeName, driverContract]);

  const errors = useMemo(() => (form ? validateMsForm(form) : []), [form]);
  const readOnly = !!request && !['draft', 'sent'].includes(request.status);

  const setText = (k: MsTextKey, v: string) =>
    setForm((f) => (f ? { ...f, text: { ...f.text, [k]: v } } : f));
  const toggle = (group: MsCheckGroup, k: MsCheckKey, v: boolean) =>
    setForm((f) => {
      if (!f) return f;
      const checks = { ...f.checks };
      if (v && SINGLE_CHOICE.includes(group)) {
        for (const other of MS_CHECK_GROUPS[group]) checks[other as MsCheckKey] = false;
      }
      checks[k] = v;
      return { ...f, checks };
    });

  const onPlannedStart = (v: string) => {
    setPlannedStart(v);
    if (v) {
      const [y, m, d] = v.split('-');
      setText('previsao_inicio', `${d}/${m}/${y}`);
    }
  };

  async function persist() {
    if (!form || !loaded || !check) return null;
    const reasons = MS_CHECK_GROUPS.motivo.filter((k) => form.checks[k as MsCheckKey]);
    return save.mutateAsync({
      id: request?.id ?? savedId ?? undefined,
      order_id: loaded.order.id,
      trip_id: loaded.order.trip_id,
      quote_ids: loaded.tripQuoteIds,
      policy_id: (refPolicy as { id?: string } | null)?.id ?? null,
      cargo_value: loaded.tripValue,
      applied_limit: check.limit,
      limit_basis: check.basis,
      vehicle_plate: form.text.placa?.trim() || vehiclePlate || null,
      planned_start_at: plannedStart
        ? new Date(`${plannedStart}T12:00:00-03:00`).toISOString()
        : null,
      reasons: reasons.length ? reasons.map((r) => r.replace('motivo_', '')) : ['limite'],
      form_data: form,
    });
  }

  async function onSaveDraft() {
    try {
      const saved = await persist();
      if (saved) onOpenChange(false);
    } catch {
      // toast já exibido pelo hook
    }
  }

  async function onSend() {
    setShowErrors(true);
    if (errors.length) return;
    const toList = parseEmailList(to);
    if (!toList.length) return;
    try {
      const saved = await persist();
      if (!saved) return;
      setSavedId(saved.id);
      await send.mutateAsync({
        requestId: saved.id,
        to: toList,
        cc: parseEmailList(cc),
        message: message.trim() || undefined,
        resend: saved.status === 'sent',
      });
      onOpenChange(false);
    } catch {
      // toast já exibido pelo hook; diálogo fica aberto e o próximo clique reusa o rascunho
    }
  }

  const busy = save.isPending || send.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liberação de embarque excepcional — MS Seguros</DialogTitle>
          <DialogDescription>
            Formulário oficial da corretora, preenchido com os dados da OS. Revise antes de enviar.
            CT-e e MDF-e ficam bloqueados até a MS aceitar ou o prazo de 3 dias úteis vencer.
          </DialogDescription>
        </DialogHeader>

        {check && !check.ok && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Carga {brl(check.cargoValue)} excede {check.label} em {brl(check.excess)}.
            </span>
          </div>
        )}

        {isLoading || !form ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando dados da OS…
          </div>
        ) : (
          <fieldset disabled={readOnly || busy} className="space-y-6">
            {SECTIONS.map((section) => (
              <section key={section.title} className="space-y-3">
                <h3 className="text-sm font-semibold border-b pb-1">{section.title}</h3>
                {section.title === 'Dados do embarque' && (
                  <div className="grid gap-1 sm:w-1/2">
                    <Label htmlFor="planned-start">Data prevista de início (calendário)</Label>
                    <Input
                      id="planned-start"
                      type="date"
                      value={plannedStart}
                      onChange={(e) => onPlannedStart(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.text.map((k) => (
                    <div
                      key={k}
                      className={MULTILINE.includes(k) ? 'grid gap-1 sm:col-span-2' : 'grid gap-1'}
                    >
                      <Label htmlFor={`ms-${k}`}>{MS_TEXT_LABELS[k]}</Label>
                      {MULTILINE.includes(k) ? (
                        <Textarea
                          id={`ms-${k}`}
                          rows={2}
                          value={form.text[k] ?? ''}
                          onChange={(e) => setText(k, e.target.value)}
                        />
                      ) : (
                        <Input
                          id={`ms-${k}`}
                          value={form.text[k] ?? ''}
                          onChange={(e) => setText(k, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {section.groups.map((g) => (
                  <div key={g} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{GROUP_LABELS[g]}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {MS_CHECK_GROUPS[g].map((k) => (
                        <label key={k} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox
                            checked={!!form.checks[k as MsCheckKey]}
                            onCheckedChange={(v) => toggle(g, k as MsCheckKey, v === true)}
                          />
                          {CHECK_LABELS[k as MsCheckKey]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">E-mail</h3>
              <div className="grid gap-1">
                <Label htmlFor="ms-to">Para</Label>
                <Textarea id="ms-to" rows={2} value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="ms-cc">Cc</Label>
                <Input id="ms-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="ms-msg">Observação no corpo do e-mail (opcional)</Label>
                <Textarea
                  id="ms-msg"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </section>

            {showErrors && errors.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-destructive space-y-0.5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        {!readOnly && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onSaveDraft} disabled={busy || !form}>
              <Save className="h-4 w-4 mr-1" /> Salvar rascunho
            </Button>
            <Button onClick={onSend} disabled={busy || !form}>
              {busy ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-1" />
              )}
              {request?.status === 'sent' ? 'Reenviar à MS' : 'Enviar à MS'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface InsuranceExceptionDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: InsuranceExceptionRequest | null;
}

/** Registrar resposta da MS: aceito (com código/anexo) ou recusado. Evidência obrigatória. */
export function InsuranceExceptionDecisionDialog({
  open,
  onOpenChange,
  request,
}: InsuranceExceptionDecisionDialogProps) {
  const { user } = useAuth();
  const decide = useDecideInsuranceException();
  const [notes, setNotes] = useState('');
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setNotes('');
      setCode('');
      setFile(null);
    }
  }, [open]);

  if (!request) return null;
  const hasEvidence = !!file || notes.trim().length > 0;

  const run = async (decision: 'accepted' | 'rejected') => {
    await decide.mutateAsync({
      id: request.id,
      decision,
      notes,
      liberationCode: code,
      file,
      userId: user?.id,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resposta da MS</DialogTitle>
          <DialogDescription>
            Anexe o e-mail/PDF de resposta ou descreva a resposta. Aceite libera CT-e e MDF-e deste
            embarque (até {brl(Number(request.cargo_value))}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1">
            <Label htmlFor="dec-file">Resposta da MS (PDF, .eml, imagem)</Label>
            <Input
              id="dec-file"
              type="file"
              accept=".pdf,.eml,.png,.jpg,.jpeg,.txt,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="dec-notes">Resumo da resposta / exigências da seguradora</Label>
            <Textarea
              id="dec-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: aceito mediante escolta armada em todo o percurso"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="dec-code">Código de liberação / nº averbação (se informado)</Label>
            <Input id="dec-code" value={code} onChange={(e) => setCode(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Usado como nAver no MDF-e deste embarque.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            disabled={!hasEvidence || decide.isPending}
            onClick={() => run('rejected')}
          >
            Recusado
          </Button>
          <Button disabled={!hasEvidence || decide.isPending} onClick={() => run('accepted')}>
            {decide.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Aceito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
