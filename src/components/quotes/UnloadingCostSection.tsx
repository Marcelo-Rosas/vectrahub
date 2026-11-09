import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePricingRulesByCategory, type PricingRuleConfig } from '@/hooks/usePricingRules';
import type { PriceTableMethodology } from '@/lib/pricingMethodology';

export interface UnloadingCostItem {
  id: string;
  ruleKey?: string;
  legacyId?: string;
  name: string;
  code: string;
  unit?: string;
  quantity: number;
  unitValue: number;
  total: number;
}

interface UnloadingCostSectionProps {
  value: number;
  onChange: (total: number, items: UnloadingCostItem[]) => void;
  initialItems?: UnloadingCostItem[];
  readOnly?: boolean;
  methodology?: PriceTableMethodology;
  vehicleTypeId?: string | null;
}

export function UnloadingCostSection({
  value,
  onChange,
  initialItems = [],
  readOnly = false,
  methodology,
  vehicleTypeId,
}: UnloadingCostSectionProps) {
  const { data: rates, isLoading } = usePricingRulesByCategory(
    'carga_descarga',
    true,
    methodology ? { methodology, vehicleTypeId } : undefined
  );

  const [quantitiesByRate, setQuantitiesByRate] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (initialItems.length > 0) {
      const map = new Map<string, number>();
      for (const item of initialItems) {
        if (item.quantity > 0) map.set(item.ruleKey ?? item.code ?? item.id, item.quantity);
      }
      setQuantitiesByRate(map);
    }
  }, [initialItems]);

  const getRuleUnit = (rule: PricingRuleConfig) => {
    const raw = (rule.metadata as { unit?: unknown } | null | undefined)?.unit;
    return typeof raw === 'string' && raw.trim() ? raw : 'unidade';
  };

  const getRuleLegacyId = (rule: PricingRuleConfig) => {
    const raw = (rule.metadata as { legacy_id?: unknown } | null | undefined)?.legacy_id;
    return typeof raw === 'string' && raw.trim() ? raw : undefined;
  };

  const toSelectionKey = (rule: PricingRuleConfig) => rule.key;

  const buildItems = (
    allRules: PricingRuleConfig[],
    quantities: Map<string, number>
  ): UnloadingCostItem[] =>
    allRules.map((rule) => {
      const selectionKey = toSelectionKey(rule);
      const q = quantities.get(selectionKey) ?? 0;
      const unitValue = Number(rule.value) || 0;
      const total = q * unitValue;
      return {
        id: selectionKey,
        ruleKey: selectionKey,
        legacyId: getRuleLegacyId(rule),
        name: rule.label,
        code: rule.key,
        unit: getRuleUnit(rule),
        quantity: q,
        unitValue,
        total,
      };
    });

  const handleQuantityChange = (rate: PricingRuleConfig, qty: number) => {
    if (!rates) return;
    const selectionKey = toSelectionKey(rate);
    setQuantitiesByRate((prev) => {
      const next = new Map(prev);
      if (qty > 0) next.set(selectionKey, qty);
      else next.delete(selectionKey);

      const items = buildItems(rates, next);
      const total = items.reduce((s, i) => s + i.total, 0);
      onChange(
        total,
        items.filter((i) => i.quantity > 0)
      );
      return next;
    });
  };

  const computedTotal = useMemo(() => {
    if (!rates) return 0;
    return rates.reduce((s, rule) => {
      const q = quantitiesByRate.get(toSelectionKey(rule)) ?? 0;
      return s + q * (Number(rule.value) || 0);
    }, 0);
  }, [rates, quantitiesByRate]);

  if (isLoading || !rates?.length) {
    return (
      <div className="space-y-2">
        <Label>Carga e Descarga</Label>
        <div className="text-sm text-muted-foreground">
          {isLoading ? 'Carregando...' : 'Nenhum item cadastrado na tabela.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Carga e Descarga</Label>
      <div className="rounded-md border divide-y">
        {rates.map((rate) => {
          const selectionKey = toSelectionKey(rate);
          const unitValue = Number(rate.value) || 0;
          const unit = getRuleUnit(rate);
          const qty = quantitiesByRate.get(selectionKey) ?? 0;
          const lineTotal = qty * unitValue;
          return (
            <div
              key={rate.id || `${selectionKey}:${rate.methodology}`}
              className="flex items-center gap-3 px-3 py-2 bg-background hover:bg-muted/30"
            >
              <span className="flex-1 text-sm truncate">{rate.label}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                R$ {unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {unit}
              </span>
              <div className="w-20">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={qty || ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    handleQuantityChange(rate, isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  placeholder="0"
                  disabled={readOnly}
                  className="h-8 text-right"
                />
              </div>
              <span className="w-24 text-right text-sm tabular-nums">
                R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end text-sm font-medium">
        Total: R$ {computedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}
