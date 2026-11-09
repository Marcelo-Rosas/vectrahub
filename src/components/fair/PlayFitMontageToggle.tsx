import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  options: readonly number[];
  onChange: (v: number) => void;
  className?: string;
};

/** Segmented control montagem — opções dinâmicas por linha/espessura. */
export function PlayFitMontageToggle({ value, options, onChange, className }: Props) {
  const cols = Math.min(4, Math.max(2, options.length));

  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      className={cn('grid w-full gap-1.5', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      onValueChange={(v) => {
        const n = Number(v);
        if (options.includes(n)) onChange(n);
      }}
    >
      {options.map((n) => (
        <ToggleGroupItem
          key={n}
          value={String(n)}
          className={cn(
            'h-12 min-w-0 flex-1 touch-manipulation px-0 text-base font-semibold tabular-nums',
            'data-[state=on]:shadow-sm md:h-10 md:text-sm'
          )}
          aria-label={`${n} placas por pallet`}
        >
          {n}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
