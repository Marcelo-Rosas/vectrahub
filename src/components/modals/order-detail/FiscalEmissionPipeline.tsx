import { CheckCircle2, Circle, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FiscalPipelineStep = 'cte' | 'vpo' | 'ciot' | 'mdfe';

const STEPS: Array<{ id: FiscalPipelineStep; label: string }> = [
  { id: 'cte', label: 'CT-e' },
  { id: 'vpo', label: 'VPO' },
  { id: 'ciot', label: 'CIOT' },
  { id: 'mdfe', label: 'MDF-e' },
];

interface FiscalEmissionPipelineProps {
  /** Aba atual no fluxo fiscal. */
  current: FiscalPipelineStep;
  /** Steps já concluídos (ex.: CT-e autorizado). */
  done?: Partial<Record<FiscalPipelineStep, boolean>>;
  className?: string;
}

/**
 * Trilha obrigatória antes do MDF-e: CT-e → VPO → CIOT → MDF-e.
 * Visual only — emissão real ainda nos panels de cada aba.
 */
export function FiscalEmissionPipeline({
  current,
  done = {},
  className,
}: FiscalEmissionPipelineProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 px-3 py-2 text-xs',
        className
      )}
      role="nav"
      aria-label="Fluxo fiscal antes do MDF-e"
    >
      <Ticket className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground mr-1">Fluxo:</span>
      {STEPS.map((step, i) => {
        const isCurrent = step.id === current;
        const isDone = Boolean(done[step.id]);
        return (
          <span key={step.id} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/60">→</span>}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
                isCurrent && 'bg-primary/10 text-primary ring-1 ring-primary/30',
                !isCurrent && isDone && 'text-emerald-700 dark:text-emerald-400',
                !isCurrent && !isDone && 'text-muted-foreground'
              )}
            >
              {isDone ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Circle className={cn('w-3 h-3', isCurrent && 'fill-primary/20')} />
              )}
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
