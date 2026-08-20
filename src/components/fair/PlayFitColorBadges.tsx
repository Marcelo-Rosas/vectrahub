import { cn } from '@/lib/utils';
import type { PlayFitColor } from '@/lib/playfit-catalog';

type Props = {
  colors: PlayFitColor[];
  value?: string | null;
  onChange?: (colorId: string) => void;
  className?: string;
};

/** Swatches cor PlayFit — catálogo feira. */
export function PlayFitColorBadges({ colors, value, onChange, className }: Props) {
  if (colors.length === 0) return null;

  const selectable = typeof onChange === 'function';

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {colors.map((c) => {
        const selected = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            disabled={!selectable}
            title={c.label}
            aria-label={c.label}
            aria-pressed={selectable ? selected : undefined}
            onClick={() => onChange?.(c.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium touch-manipulation',
              selectable && 'cursor-pointer transition-colors hover:bg-muted/60',
              selected && 'border-primary ring-2 ring-primary/30',
              !selectable && 'cursor-default opacity-90'
            )}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-inner"
              style={{ backgroundColor: c.hex }}
            />
            <span className="max-w-[8rem] truncate">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
