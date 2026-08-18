import { useEffect, useState } from 'react';
import {
  Ticket,
  Landmark,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Info,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FiscalEmissionPipeline } from '@/components/modals/order-detail/FiscalEmissionPipeline';
import { useUpdateOrder } from '@/hooks/useOrders';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useConsultVpoVehicle } from '@/hooks/useConsultVpoVehicle';
import { useEmitVpo } from '@/hooks/useEmitVpo';
import { formatCnpjDisplay } from '@/lib/formatters';
import type { VpoEmissionRecord } from '@/lib/freightCalculator';
import {
  canEmitVpo,
  DEFAULT_VPO_TIPO_VIAGEM,
  fornecedoraCnpjOf,
  labelVpoTipoViagem,
  lookupVpoVehicleByPlate,
  normalizeVpoTipoViagem,
  resolveIdVpo,
  resolveVpoVehicleForUi,
  tipoValeFromLookup,
  VPO_EMISSOR_INFO,
  vpoLookupFromConsult,
  type VpoTipoViagem,
} from '@/lib/vpo-emissores';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface OrderVpoTabProps {
  orderId: string;
  hasVpo: boolean | null | undefined;
  tollValue: number | null | undefined;
  tollPlazaCount?: number;
  vehiclePlate: string | null | undefined;
  canManage: boolean;
  /** CT-e autorizado — pré-req visual do fluxo. */
  cteOk?: boolean;
  /** Emissão VPO já gravada em pricing_breakdown.meta.vpo */
  vpoEmission?: VpoEmissionRecord | null;
}

/** Rota sem praça e sem valor → Lei 10.209 não exige VPO; Focus: omitir grupo. */
export function isTollFreeRoute(
  tollPlazaCount: number,
  tollValue: number | null | undefined
): boolean {
  return tollPlazaCount === 0 && (tollValue == null || Number(tollValue) <= 0);
}

export function isVpoSatisfied(
  hasVpo: boolean | null | undefined,
  tollPlazaCount: number,
  tollValue: number | null | undefined
): boolean {
  return Boolean(hasVpo) || isTollFreeRoute(tollPlazaCount, tollValue);
}

/**
 * Aba VPO (Vale-Pedágio Obrigatório) — passo após Risco/CT-e no fluxo fiscal.
 * UI preparada p/ WebRouter → Focus `dispositivos_vale_pedagio[]`.
 * Sem pedágio: dispensado — NÃO enviar o grupo no MDF-e.
 */
export function OrderVpoTab({
  orderId,
  hasVpo,
  tollValue,
  tollPlazaCount = 0,
  vehiclePlate,
  canManage,
  cteOk = false,
  vpoEmission = null,
}: OrderVpoTabProps) {
  const updateOrder = useUpdateOrder();
  const emitVpo = useEmitVpo(orderId);
  const { data: company } = useCompanySettings();
  const catalogVpo = lookupVpoVehicleByPlate(vehiclePlate);
  const plateConsult = useConsultVpoVehicle(orderId, vehiclePlate);
  const liveVpo = vpoLookupFromConsult(plateConsult.data?.match);
  const vehicleVpo = resolveVpoVehicleForUi({
    live: liveVpo,
    catalog: catalogVpo,
    liveFetched: plateConsult.isFetched && !plateConsult.isError,
  });

  const [cnpjFornecedora, setCnpjFornecedora] = useState('');
  const [cnpjPagador, setCnpjPagador] = useState('');
  const [idVpo, setIdVpo] = useState('');
  const [valorVpo, setValorVpo] = useState(
    tollValue != null && Number(tollValue) > 0 ? String(Number(tollValue)) : ''
  );
  const [tipoVale, setTipoVale] = useState<'01' | '04'>('01');
  const [tipoViagem, setTipoViagem] = useState<VpoTipoViagem>(DEFAULT_VPO_TIPO_VIAGEM);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!vehicleVpo) return;
    setCnpjFornecedora(fornecedoraCnpjOf(vehicleVpo.emissor));
    setTipoVale(tipoValeFromLookup(vehicleVpo));
  }, [vehicleVpo]);

  useEffect(() => {
    const digits = (company?.cnpj || '').replace(/\D/g, '').slice(0, 14);
    if (digits.length === 14) setCnpjPagador(digits);
  }, [company?.cnpj]);

  useEffect(() => {
    if (tollValue != null && Number(tollValue) > 0) {
      setValorVpo(String(Number(tollValue)));
    }
  }, [tollValue]);

  useEffect(() => {
    if (!vpoEmission) return;
    const id = resolveIdVpo(vpoEmission);
    if (id) setIdVpo(id);
    if (vpoEmission.cnpjFornecedora) {
      setCnpjFornecedora(vpoEmission.cnpjFornecedora.replace(/\D/g, '').slice(0, 14));
    }
    if (vpoEmission.cnpjPagador) {
      setCnpjPagador(vpoEmission.cnpjPagador.replace(/\D/g, '').slice(0, 14));
    }
    if (vpoEmission.tipoVale === '01' || vpoEmission.tipoVale === '04') {
      setTipoVale(vpoEmission.tipoVale);
    }
    const tv =
      normalizeVpoTipoViagem(vpoEmission.tipoViagem) ||
      normalizeVpoTipoViagem(vpoEmission.recibo?.tipo);
    if (tv) setTipoViagem(tv);
    if (vpoEmission.valorReais != null) setValorVpo(String(vpoEmission.valorReais));
  }, [vpoEmission]);

  const tollFree = isTollFreeRoute(tollPlazaCount, tollValue);
  const persistedIdVpo = resolveIdVpo(vpoEmission);
  const vpoOk = isVpoSatisfied(hasVpo, tollPlazaCount, tollValue) || Boolean(persistedIdVpo);
  const emissorInfo = vehicleVpo ? VPO_EMISSOR_INFO[vehicleVpo.emissor] : null;
  const canEmit = canEmitVpo({
    canManage,
    tollFree,
    plate: vehiclePlate,
    persistedId: persistedIdVpo,
    emitPending: emitVpo.isPending,
  });

  const tollFmt =
    tollValue != null
      ? new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
        }).format(Number(tollValue))
      : '—';

  async function markVpoReady() {
    if (!canManage) return;
    const id = idVpo.replace(/\D/g, '').slice(0, 20);
    const forn = cnpjFornecedora.replace(/\D/g, '').slice(0, 14);
    const pag = cnpjPagador.replace(/\D/g, '').slice(0, 14);
    const valor = Number(valorVpo);
    if (id.length < 8 || forn.length !== 14 || pag.length !== 14 || !(valor > 0)) {
      toast.error('Preencha IDVPO, CNPJs (14 dígitos) e valor do vale-pedágio antes de gravar.');
      return;
    }
    setMarking(true);
    try {
      const { data: row, error: fetchErr } = await supabase
        .from('orders')
        .select('pricing_breakdown')
        .eq('id', orderId)
        .single();
      if (fetchErr) throw fetchErr;
      const currentBreakdown =
        row?.pricing_breakdown && typeof row.pricing_breakdown === 'object'
          ? (row.pricing_breakdown as Record<string, unknown>)
          : {};
      const currentMeta =
        currentBreakdown.meta && typeof currentBreakdown.meta === 'object'
          ? (currentBreakdown.meta as Record<string, unknown>)
          : {};
      const vpoRecord: VpoEmissionRecord = {
        emissor: vehicleVpo?.emissor || 'EXTERNAL',
        tag: vehicleVpo?.tag ?? null,
        idANTT: id,
        idVpo: id,
        cnpjFornecedora: forn,
        cnpjPagador: pag,
        tipoVale,
        tipoViagem,
        valorReais: valor,
        source: 'partner_external',
        categoriaCombinacaoVeicular: '04',
        emittedAt: new Date().toISOString(),
      };
      await updateOrder.mutateAsync({
        id: orderId,
        updates: {
          has_vpo: true,
          pricing_breakdown: {
            ...currentBreakdown,
            calculatedAt:
              typeof currentBreakdown.calculatedAt === 'string'
                ? currentBreakdown.calculatedAt
                : new Date().toISOString(),
            version: currentBreakdown.version || '4.0',
            status: currentBreakdown.status || 'OK',
            meta: { ...currentMeta, vpo: vpoRecord },
          } as never,
        },
      });
      toast.success(`VPO gravado · IDVPO ${id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Falha ao marcar VPO');
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="space-y-5">
      <FiscalEmissionPipeline current="vpo" done={{ cte: cteOk, vpo: vpoOk }} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Vale-Pedágio Obrigatório (VPO)</h3>
          <Badge
            variant="outline"
            className={
              tollFree
                ? 'text-[10px] uppercase text-slate-700 border-slate-300'
                : hasVpo
                  ? 'text-[10px] uppercase text-emerald-700 border-emerald-300'
                  : 'text-[10px] uppercase text-amber-700 border-amber-300'
            }
          >
            {tollFree ? 'Dispensado' : hasVpo ? 'Informado' : 'Pendente'}
          </Badge>
        </div>
        {!tollFree && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!vehiclePlate || plateConsult.isFetching}
              title="Consultar placa no WebRouter (consultarVeiculo)"
              onClick={() => void plateConsult.refetch()}
            >
              {plateConsult.isFetching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Consultar placa
            </Button>
            <Button
              size="sm"
              className="gap-2"
              disabled={!canEmit}
              title={
                persistedIdVpo
                  ? `VPO já emitido · ${persistedIdVpo}`
                  : !vehiclePlate
                    ? 'Informe a placa do caminhão'
                    : 'Revisita a rota WebRouter e emite o vale-pedágio'
              }
              onClick={() => {
                if (!canEmit) return;
                void emitVpo
                  .mutateAsync({ tipoViagem })
                  .then((res) => {
                    const id = resolveIdVpo(res);
                    if (id) setIdVpo(id);
                    if (res.cnpjFornecedora) {
                      setCnpjFornecedora(res.cnpjFornecedora.replace(/\D/g, '').slice(0, 14));
                    }
                    if (res.valorReais != null) setValorVpo(String(res.valorReais));
                    void plateConsult.refetch();
                  })
                  .catch(() => {
                    /* toast no onError do hook */
                  });
              }}
            >
              {emitVpo.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : persistedIdVpo ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Ticket className="w-3.5 h-3.5" />
              )}
              {persistedIdVpo ? 'VPO emitido' : 'Emitir VPO (WebRouter)'}
            </Button>
          </div>
        )}
      </div>

      {tollFree ? (
        <div className="space-y-3 text-sm rounded-md border border-slate-300/60 bg-slate-50 dark:bg-slate-900/40 p-3">
          <p className="flex items-start gap-2 text-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-600" />
            <span>
              OS <strong>sem praças de pedágio</strong> (0 praças, valor R$&nbsp;0 / vazio). Lei
              10.209/2001 só exige VPO em rodovia concedida com pedágio.
            </span>
          </p>
          <ul className="list-disc pl-8 text-muted-foreground space-y-1 text-xs">
            <li>
              Focus: <strong>omitir</strong>{' '}
              <code className="text-[11px]">modal_rodoviario.dispositivos_vale_pedagio</code> — não
              enviar array vazio nem valor 0,01.
            </li>
            <li>
              Schema Focus: coleção <code className="text-[11px]">[1–1000]</code> só quando o grupo
              existe; cada item exige CNPJ fornecedora, pagador, IDVPO, valor, tipo 01/04.
            </li>
            <li>
              SEFAZ: ausência do grupo <code className="text-[11px]">valePed</code> = aceito quando
              não há VPO a declarar. Não há rejeição por “VPO zero”.
            </li>
            <li>
              Pagamento frete: componente tipo <code className="text-[11px]">01</code> (Vale
              Pedágio) em <code className="text-[11px]">pagamentos[].componentes</code> também fica
              de fora.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground pl-6">
            Checklist fiscal: VPO = OK (dispensado). Se rota mudar e aparecer pedágio, recalcule
            praças e emita VPO antes do MDF-e.
          </p>
        </div>
      ) : (
        <p
          className={
            vehicleVpo?.ativo
              ? 'text-sm rounded-md border border-emerald-300/50 bg-emerald-50 text-emerald-950 p-3'
              : 'text-sm rounded-md border border-amber-300/50 bg-amber-50 text-amber-900 p-3'
          }
        >
          {plateConsult.isFetching && !vehicleVpo ? (
            <>
              Consultando placa <strong className="font-mono">{vehiclePlate}</strong> no WebRouter
              (consultarVeiculo)…
            </>
          ) : plateConsult.isError ? (
            <>
              Falha ao consultar placa no WebRouter:{' '}
              {plateConsult.error instanceof Error
                ? plateConsult.error.message
                : 'tente Consultar placa'}
              . Emitir VPO ainda consulta ao vivo na Edge.
            </>
          ) : vehicleVpo?.ativo ? (
            <>
              Placa <strong className="font-mono">{vehicleVpo.plate}</strong> cadastrada em{' '}
              <strong>{emissorInfo?.nome}</strong> — TAG {vehicleVpo.tag} ativa
              {vehicleVpo.nomeProprietario ? ` · ${vehicleVpo.nomeProprietario}` : ''}. Emitir VPO
              revisita a rota no WebRouter e grava o IDVPO (idANTT). <strong>Rota Estendida</strong>{' '}
              (padrão): praça já passada na coleta não perde crédito — sobra vira benefício após
              vigência.
            </>
          ) : vehicleVpo && !vehicleVpo.ativo ? (
            <>
              Placa <strong className="font-mono">{vehicleVpo.plate}</strong> encontrada em{' '}
              <strong>{emissorInfo?.nome}</strong> mas TAG inativa ({vehicleVpo.status || '—'}).
            </>
          ) : vehiclePlate ? (
            <>
              Rota com pedágio — VPO obrigatório (Lei 10.209 + Portaria ANTT 17/2024). Placa{' '}
              <strong className="font-mono">{vehiclePlate}</strong> sem TAG ativa em nenhum emissor
              WebRouter. Focus: <code className="text-xs">dispositivos_vale_pedagio[]</code>.
            </>
          ) : (
            <>
              Rota com pedágio — VPO obrigatório (Lei 10.209 + Portaria ANTT 17/2024). Informe a
              placa do caminhão para detectar o emissor (TAG).
            </>
          )}
        </p>
      )}

      <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">Status OS</dt>
          <dd className="text-sm font-medium flex items-center gap-1.5">
            {tollFree ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                Dispensado
              </>
            ) : hasVpo ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                has_vpo
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Sem VPO
              </>
            )}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground flex items-center gap-1">
            <Landmark className="w-3 h-3" /> Pedágio (OS)
          </dt>
          <dd className="text-sm font-medium">{tollFmt}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">Praças (aba Pedágios)</dt>
          <dd className="text-sm font-medium">{tollPlazaCount}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> Placa
          </dt>
          <dd className="text-sm font-medium font-mono">{vehiclePlate || '—'}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">Emissor</dt>
          <dd className="text-sm font-medium">
            {emissorInfo ? (
              <span className="inline-flex items-center gap-1.5">
                {vehicleVpo?.ativo ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
                {emissorInfo.codigo}
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">TAG</dt>
          <dd className="text-sm font-medium font-mono">{vehicleVpo?.tag || '—'}</dd>
        </div>
      </dl>

      {!tollFree && (
        <>
          <div className="space-y-3 rounded-lg border p-4">
            <h4 className="text-sm font-medium">Rascunho dispositivo (Focus)</h4>
            <p className="text-xs text-muted-foreground">
              Emissor e TAG vêm da consulta live WebRouter (consultarVeiculo). IDVPO (idANTT /
              numero_comprovante_compra) só depois de Emitir VPO.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vpo-emissor">Emissor (placa)</Label>
                <Input
                  id="vpo-emissor"
                  readOnly
                  value={
                    plateConsult.isFetching && !emissorInfo
                      ? 'Consultando WebRouter…'
                      : emissorInfo
                        ? `${emissorInfo.codigo} — ${emissorInfo.nome}`
                        : 'Sem emissor ativo nesta placa'
                  }
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vpo-tag">TAG</Label>
                <Input
                  id="vpo-tag"
                  readOnly
                  value={vehicleVpo?.tag ?? ''}
                  placeholder="sem TAG cadastrada"
                  className="bg-muted/50 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vpo-cnpj-forn">CNPJ fornecedora do vale</Label>
                <Input
                  id="vpo-cnpj-forn"
                  inputMode="numeric"
                  placeholder="14 dígitos"
                  value={formatCnpjDisplay(cnpjFornecedora) || cnpjFornecedora}
                  onChange={(e) =>
                    setCnpjFornecedora(e.target.value.replace(/\D/g, '').slice(0, 14))
                  }
                  disabled={!canManage}
                />
                {emissorInfo && (
                  <p className="text-[11px] text-muted-foreground">{emissorInfo.nome}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vpo-cnpj-pag">CNPJ responsável pagamento</Label>
                <Input
                  id="vpo-cnpj-pag"
                  inputMode="numeric"
                  placeholder="CNPJ Vectra / embarcador"
                  value={formatCnpjDisplay(cnpjPagador) || cnpjPagador}
                  onChange={(e) => setCnpjPagador(e.target.value.replace(/\D/g, '').slice(0, 14))}
                  disabled={!canManage}
                />
                <p className="text-[11px] text-muted-foreground">
                  {company?.legal_name || company?.trade_name || 'company_settings'}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vpo-id">Nº comprovante / IDVPO</Label>
                <Input
                  id="vpo-id"
                  placeholder="idANTT após Emitir VPO"
                  value={idVpo}
                  onChange={(e) => setIdVpo(e.target.value.slice(0, 40))}
                  disabled={!canManage}
                />
                <p className="text-[11px] text-muted-foreground">
                  Não usar o número da TAG aqui — SEFAZ exige o comprovante da viagem.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vpo-valor">Valor vale-pedágio (R$)</Label>
                <Input
                  id="vpo-valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorVpo}
                  onChange={(e) => setValorVpo(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo vale-pedágio (MDF-e)</Label>
                <Select
                  value={tipoVale}
                  onValueChange={(v) => setTipoVale(v as '01' | '04')}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">01 — TAG</SelectItem>
                    <SelectItem value="04">04 — Placa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo rota VPO (SemParar)</Label>
                <Select
                  value={tipoViagem}
                  onValueChange={(v) => setTipoViagem(v as VpoTipoViagem)}
                  disabled={!canManage || Boolean(persistedIdVpo)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESTENDIDA">Rota Estendida</SelectItem>
                    <SelectItem value="PLANEJADA">Rota Planejada</SelectItem>
                    <SelectItem value="CUSTOMIZADA">Rota Customizada</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {tipoViagem === 'ESTENDIDA'
                    ? 'Coleta já passou praça → Estendida evita perda do crédito.'
                    : `Atual: ${labelVpoTipoViagem(tipoViagem)}. Planejada trava praça; praça já passada perde valor.`}
                </p>
              </div>
            </div>
          </div>

          {canManage && !hasVpo && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void markVpoReady()}
              disabled={marking}
              className="gap-2"
            >
              {marking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Marcar / gravar VPO na OS
            </Button>
          )}
          {canManage && !hasVpo && (
            <p className="text-[11px] text-muted-foreground">
              Com IdVpo de parceiro (fracionado): preencha fornecedora, pagador, IDVPO e valor →
              gravar. O MDF-e lê de <code className="text-[10px]">pricing_breakdown.meta.vpo</code>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
