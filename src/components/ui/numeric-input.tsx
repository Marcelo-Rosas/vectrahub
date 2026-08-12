import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumericInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  suffix?: string;
  prefix?: string;
  value?: number | string | null;
  onValueChange?: (val: number | null) => void;
}

/** Aceita "0,67", "0.67", "1.234,56" (pt-BR) e retorna número ou null. */
export function parseLocaleDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return null;

  let normalized = trimmed;
  if (trimmed.includes(',')) {
    // pt-BR: ponto = milhar, vírgula = decimal
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else {
    const dots = (trimmed.match(/\./g) || []).length;
    if (dots > 1) {
      normalized = trimmed.replace(/\./g, '');
    }
  }

  const num = parseFloat(normalized);
  return Number.isNaN(num) ? null : num;
}

function formatDecimalDisplay(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
    useGrouping: false,
  });
}

function clampNumber(value: number, min?: number | string, max?: number | string): number {
  let n = value;
  if (min != null && min !== '') n = Math.max(Number(min), n);
  if (max != null && max !== '') n = Math.min(Number(max), n);
  return n;
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    { suffix, prefix, onValueChange, value, onBlur, onFocus, className, min, max, ...props },
    ref
  ) => {
    const [draft, setDraft] = React.useState<string | null>(null);
    const focusedRef = React.useRef(false);

    const numericValue =
      typeof value === 'number' ? value : value != null && value !== '' ? Number(value) : null;

    const display =
      focusedRef.current && draft !== null
        ? draft
        : numericValue != null && Number.isFinite(numericValue)
          ? formatDecimalDisplay(numericValue)
          : '';

    const emitValue = (raw: string) => {
      const parsed = parseLocaleDecimal(raw);
      if (parsed == null) {
        onValueChange?.(null);
        return;
      }
      onValueChange?.(clampNumber(parsed, min, max));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw !== '' && !/^-?[\d.,]*$/.test(raw)) return;
      setDraft(raw);
      emitValue(raw);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = true;
      setDraft(
        numericValue != null && Number.isFinite(numericValue)
          ? formatDecimalDisplay(numericValue)
          : ''
      );
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = false;
      if (draft !== null) emitValue(draft);
      setDraft(null);
      onBlur?.(e);
    };

    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(prefix && 'pl-8', suffix && 'pr-10', className)}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

NumericInput.displayName = 'NumericInput';
