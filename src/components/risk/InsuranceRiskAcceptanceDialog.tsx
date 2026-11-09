import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useAcceptInsuranceRisk,
  type InsuranceExceptionRequest,
} from '@/hooks/useInsuranceExceptions';
import { formatDeadline } from '@/lib/insurance-exception-ui';
import { brl } from '@/lib/ms-liberacao-prefill';

const MIN_REASON = 20;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: InsuranceExceptionRequest | null;
}

/** Admin: liberar CT-e/MDF-e sem retorno da MS, assumindo o risco (sem cobertura até aceite). */
export function InsuranceRiskAcceptanceDialog({ open, onOpenChange, request }: Props) {
  const accept = useAcceptInsuranceRisk();
  const [reason, setReason] = useState('');
  const [aware, setAware] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setAware(false);
    }
  }, [open]);

  if (!request) return null;
  const valid = aware && reason.trim().length >= MIN_REASON;

  const confirm = async () => {
    try {
      await accept.mutateAsync({ id: request.id, reason });
      onOpenChange(false);
    } catch {
      // toast exibido pelo hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Liberar sem retorno da MS (risco assumido)</DialogTitle>
          <DialogDescription>
            Libera CT-e e MDF-e deste embarque antes da resposta da seguradora.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Sem cobertura do seguro até o aceite da MS.</p>
            <p>
              Pela apólice RC-DC (item 13), embarque acima do limite sem aceite da seguradora não
              está coberto. Em caso de sinistro, o prejuízo de até{' '}
              <strong>{brl(Number(request.cargo_value))}</strong> fica com a VECTRA HUB.
            </p>
            <p>
              Aceite tácito só após {formatDeadline(request.response_deadline)}. Esta liberação não
              antecipa esse prazo nem substitui o aceite.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-1">
            <Label htmlFor="risk-reason">Justificativa (mínimo {MIN_REASON} caracteres)</Label>
            <Textarea
              id="risk-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente exige coleta 02/10; MS sem retorno até segunda; escolta + isca contratadas"
            />
            <span className="text-xs text-muted-foreground">
              {reason.trim().length}/{MIN_REASON}
            </span>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={aware} onCheckedChange={(v) => setAware(v === true)} />
            <span>
              Estou ciente de que a carga viaja sem cobertura do seguro até o aceite da MS e assumo
              o risco em nome da VECTRA HUB.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!valid || accept.isPending} onClick={confirm}>
            {accept.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Assumir risco e liberar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
