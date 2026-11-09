import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileWarning, Mail, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useInsuranceExceptions,
  type InsuranceExceptionRequest,
} from '@/hooks/useInsuranceExceptions';
import { useUserRole } from '@/hooks/useUserRole';
import { effectiveStatus } from '@/lib/insurance-exception';
import {
  EXCEPTION_STATUS_CLASS,
  EXCEPTION_STATUS_LABEL,
  formatDeadline,
  openExceptionFile,
} from '@/lib/insurance-exception-ui';
import { brl, type DriverContract } from '@/lib/ms-liberacao-prefill';
import {
  InsuranceExceptionDecisionDialog,
  InsuranceExceptionDialog,
} from './InsuranceExceptionDialog';
import { InsuranceRiskAcceptanceDialog } from './InsuranceRiskAcceptanceDialog';

interface InsuranceExceptionPanelProps {
  orderId: string;
  /** Resultado da checagem de limite no wizard (false = excede LMG). */
  coverageOk: boolean;
  coverageMessage?: string;
  vehiclePlate?: string | null;
  vehicleTypeName?: string | null;
  driverContract?: DriverContract;
}

/**
 * Aba Risco: status da liberação excepcional MS da OS. Enquanto não houver liberação vigente
 * para carga acima do limite, emit-cte / emit-mdfe recusam a emissão.
 */
export function InsuranceExceptionPanel({
  orderId,
  coverageOk,
  coverageMessage,
  vehiclePlate,
  vehicleTypeName,
  driverContract,
}: InsuranceExceptionPanelProps) {
  const { data: requests = [] } = useInsuranceExceptions({ orderId });
  const [editing, setEditing] = useState<InsuranceExceptionRequest | null | 'new'>(null);
  const [deciding, setDeciding] = useState<InsuranceExceptionRequest | null>(null);
  const [accepting, setAccepting] = useState<InsuranceExceptionRequest | null>(null);
  const { isAdmin } = useUserRole();

  const active = requests.filter((r) => r.status !== 'cancelled');
  if (coverageOk && active.length === 0) return null;

  const now = new Date();
  const granted = active.find((r) =>
    ['accepted', 'tacit_accepted', 'risk_accepted'].includes(effectiveStatus(r, now))
  );
  const riskOnly = granted && effectiveStatus(granted, now) === 'risk_accepted';
  const inFlight = active.find((r) => ['draft', 'sent'].includes(effectiveStatus(r, now)));

  return (
    <div
      className={
        riskOnly
          ? 'rounded-md border border-orange-300 bg-orange-50/70 p-3 dark:border-orange-800 dark:bg-orange-950/30'
          : granted
            ? 'rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/30'
            : 'rounded-md border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-700 dark:bg-amber-950/30'
      }
      data-testid="insurance-exception-panel"
    >
      <div className="flex items-start gap-2">
        {riskOnly ? (
          <ShieldX className="h-5 w-5 text-orange-600 shrink-0" />
        ) : granted ? (
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
        )}
        <div className="flex-1 space-y-1 text-sm">
          <p className="font-semibold">
            {riskOnly
              ? 'Liberado com RISCO ASSUMIDO — CT-e e MDF-e liberados, SEM cobertura até o aceite da MS'
              : granted
                ? 'Liberação excepcional vigente — CT-e e MDF-e liberados'
                : 'Requer liberação excepcional da MS — CT-e e MDF-e bloqueados'}
          </p>
          {!coverageOk && coverageMessage && (
            <p className="text-muted-foreground">{coverageMessage}</p>
          )}
        </div>
        {!inFlight && !granted && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <FileWarning className="h-4 w-4 mr-1" /> Solicitar liberação
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <ul className="mt-3 space-y-2">
          {active.map((r) => {
            const st = effectiveStatus(r, now);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded bg-background/70 px-2 py-1.5 text-sm"
              >
                <Badge className={EXCEPTION_STATUS_CLASS[st]}>{EXCEPTION_STATUS_LABEL[st]}</Badge>
                <span>{brl(Number(r.cargo_value))}</span>
                {r.vehicle_plate && (
                  <span className="text-muted-foreground">· {r.vehicle_plate}</span>
                )}
                {(st === 'sent' || st === 'risk_accepted') && (
                  <span className="text-muted-foreground">
                    · aceite tácito após {formatDeadline(r.response_deadline)}
                  </span>
                )}
                {st === 'risk_accepted' && r.risk_acceptance_reason && (
                  <span className="w-full text-xs text-orange-800 dark:text-orange-300">
                    Risco assumido em {formatDeadline(r.risk_accepted_at)}:{' '}
                    {r.risk_acceptance_reason}
                  </span>
                )}
                {r.liberation_code && (
                  <span className="text-muted-foreground">· cód. {r.liberation_code}</span>
                )}
                <span className="ml-auto flex gap-1">
                  {r.docx_storage_path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openExceptionFile(r.docx_storage_path)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {(st === 'draft' || st === 'sent' || st === 'risk_accepted') && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      <Mail className="h-4 w-4 mr-1" />{' '}
                      {st === 'draft' ? 'Revisar e enviar' : 'Reenviar'}
                    </Button>
                  )}
                  {st === 'sent' && isAdmin && (
                    <Button size="sm" variant="destructive" onClick={() => setAccepting(r)}>
                      Assumir risco
                    </Button>
                  )}
                  {(st === 'sent' || st === 'risk_accepted') && (
                    <Button size="sm" onClick={() => setDeciding(r)}>
                      Registrar resposta
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Todas as liberações em{' '}
        <Link className="underline" to="/seguro/liberacoes">
          Seguro → Liberações
        </Link>
        .
      </p>

      <InsuranceExceptionDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        orderId={orderId}
        request={editing === 'new' ? null : editing}
        vehiclePlate={vehiclePlate}
        vehicleTypeName={vehicleTypeName}
        driverContract={driverContract}
      />
      <InsuranceRiskAcceptanceDialog
        open={accepting !== null}
        onOpenChange={(o) => !o && setAccepting(null)}
        request={accepting}
      />
      <InsuranceExceptionDecisionDialog
        open={deciding !== null}
        onOpenChange={(o) => !o && setDeciding(null)}
        request={deciding}
      />
    </div>
  );
}
