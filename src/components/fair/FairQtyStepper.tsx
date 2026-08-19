import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  className?: string;
  compact?: boolean;
};

/** Stepper touch-friendly — evita input number nativo no celular. */
export function FairQtyStepper({ value, onChange, min = 1, className, compact }: Props) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(value + 1);

  const btnClass = compact ? 'h-9 w-9' : 'h-11 w-11 shrink-0 touch-manipulation';

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border bg-background',
        compact ? 'h-9' : 'h-11',
        className
      )}
      role="group"
      aria-label="Quantidade"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btnClass, 'rounded-r-none')}
        onClick={dec}
        disabled={value <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </Button>
      <span
        className={cn(
          'min-w-[2.25rem] text-center font-semibold tabular-nums select-none',
          compact ? 'text-sm' : 'text-base'
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btnClass, 'rounded-l-none')}
        onClick={inc}
        aria-label="Aumentar quantidade"
      >
        <Plus className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </Button>
    </div>
  );
}
