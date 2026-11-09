import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FairTenant } from '@/lib/fair-tenant';

export function FairTenantSwitcher({
  tenants,
  value,
  onValueChange,
  className,
}: {
  tenants: readonly FairTenant[];
  value: string;
  onValueChange: (slug: string) => void;
  className?: string;
}) {
  if (tenants.length === 0) return null;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={
          className ?? 'h-10 min-h-10 max-w-[min(100%,280px)] touch-manipulation text-sm md:h-9'
        }
        aria-label="Embarcador feira"
      >
        <SelectValue placeholder="Embarcador" />
      </SelectTrigger>
      <SelectContent className="z-50 max-h-[min(70vh,320px)]">
        {tenants.map((t) => (
          <SelectItem key={t.id} value={t.slug} className="min-h-10">
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
