import { useState } from 'react';
import {
  Ticket,
  Landmark,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Ban,
  Info,
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
import { toast } from 'sonner';

interface OrderVpoTabProps {
  orderId: string;
  hasVpo: boolean | null | undefined;
  tollValue: number | null | undefined;
  tollPlazaCount?: number;
  vehiclePlate: string | null | undefined;
  canManage: boolean;
  /** CT-e autorizado — pré-req visual do fluxo. */
  cteOk?: boolean;
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
}: OrderVpoTabProps) {
  const updateOrder = useUpdateOrder();
  const [cnpjFornecedora, setCnpjFornecedora] = useState('');
  const [cnpjPagador, setCnpjPagador] = useState('');
  const [idVpo, setIdVpo] = useState('');
  const [valorVpo, setValorVpo] = useState(
    tollValue != null && Number(tollValue) > 0 ? String(Number(tollValue)) : ''
  );
  const [tipoVale, setTipoVale] = useState<'01' | '04'>('01');
  const [marking, setMarking] = useState(false);

  const tollFree = isTollFreeRoute(tollPlazaCount, tollValue);
  const vpoOk = isVpoSatisfied(hasVpo, tollPlazaCount, tollValue);

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
    setMarking(true);
    try {
      await updateOrder.mutateAsync({
        id: orderId,
        updates: { has_vpo: true },
      });
      toast.success('OS marcada com VPO (has_vpo). Integração WebRouter em breve.');
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
          <Button size="sm" disabled className="gap-2" title="WebRouter VPO — em implementação">
            <Ban className="w-3.5 h-3.5" />
            Emitir VPO (WebRouter)
          </Button>
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
        <p className="text-sm rounded-md border border-amber-300/50 bg-amber-50 text-amber-900 p-3">
          Rota com pedágio — VPO obrigatório (Lei 10.209 + Portaria ANTT 17/2024). Focus:{' '}
          <code className="text-xs">dispositivos_vale_pedagio[]</code> com CNPJ fornecedora, IDVPO,
          valor, tipo TAG (01) ou placa (04). WebRouter ainda não ligado.
        </p>
      )}

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-lg border p-4">
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
      </dl>

      {!tollFree && (
        <>
          <div className="space-y-3 rounded-lg border p-4">
            <h4 className="text-sm font-medium">Rascunho dispositivo (Focus)</h4>
            <p className="text-xs text-muted-foreground">
              Campos alinhados ao schema Focus. Persistência no MDF-e virá com WebRouter — valores
              ficam só nesta tela por enquanto.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vpo-cnpj-forn">CNPJ fornecedora do vale</Label>
                <Input
                  id="vpo-cnpj-forn"
                  inputMode="numeric"
                  placeholder="14 dígitos"
                  value={cnpjFornecedora}
                  onChange={(e) =>
                    setCnpjFornecedora(e.target.value.replace(/\D/g, '').slice(0, 14))
                  }
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vpo-cnpj-pag">CNPJ responsável pagamento</Label>
                <Input
                  id="vpo-cnpj-pag"
                  inputMode="numeric"
                  placeholder="CNPJ Vectra / embarcador"
                  value={cnpjPagador}
                  onChange={(e) => setCnpjPagador(e.target.value.replace(/\D/g, '').slice(0, 14))}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vpo-id">Nº comprovante / IDVPO</Label>
                <Input
                  id="vpo-id"
                  placeholder="numero_comprovante_compra"
                  value={idVpo}
                  onChange={(e) => setIdVpo(e.target.value.slice(0, 40))}
                  disabled={!canManage}
                />
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
                <Label>Tipo vale-pedágio</Label>
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
              Marcar VPO informado na OS
            </Button>
          )}
        </>
      )}
    </div>
  );
}
