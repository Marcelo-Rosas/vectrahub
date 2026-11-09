import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePricingRulesByCategory, type PricingRuleConfig } from '@/hooks/usePricingRules';
import { compareSkuNatural } from '@/lib/sku-sort';
import type { PriceTableMethodology } from '@/lib/pricingMethodology';

export interface EquipmentRentalItem {
  id: string;
  ruleKey?: string;
  legacyId?: string;
  name: string;
  code: string;
  unit?: string;
  selected: boolean;
  quantity: number;
  unitValue: number;
  total: number;
  description?: string;
}

interface EquipmentRentalSectionProps {
  value: number;
  onChange: (total: number, items: EquipmentRentalItem[]) => void;
  initialItems?: EquipmentRentalItem[];
  readOnly?: boolean;
  methodology?: PriceTableMethodology;
  vehicleTypeId?: string | null;
}

export function EquipmentRentalSection({
  value,
  onChange,
  initialItems = [],
  readOnly = false,
  methodology,
  vehicleTypeId,
}: EquipmentRentalSectionProps) {
  const { data: rates, isLoading } = usePricingRulesByCategory(
    'aluguel',
    true,
    methodology ? { methodology, vehicleTypeId } : undefined
  );

  const sortedRates = useMemo(
    () =>
      [...(rates ?? [])].sort(
        (a, b) => compareSkuNatural(a.key, b.key) || compareSkuNatural(a.label, b.label)
      ),
    [rates]
  );

  const [selectionByRate, setSelectionByRate] = useState<
    Map<string, { selected: boolean; quantity: number; description?: string }>
  >(new Map());

  useEffect(() => {
    if (initialItems.length > 0) {
      const map = new Map<string, { selected: boolean; quantity: number; description?: string }>();
      for (const item of initialItems) {
        if (item.selected && item.quantity > 0) {
          map.set(item.ruleKey ?? item.code ?? item.id, {
            selected: true,
            quantity: item.quantity,
            description: item.description,
          });
        }
      }
      setSelectionByRate(map);
    }
  }, [initialItems]);

  const getRuleUnit = (rule: PricingRuleConfig) => {
    const raw = (rule.metadata as { unit?: unknown } | null | undefined)?.unit;
    return typeof raw === 'string' && raw.trim() ? raw : 'dia';
  };

  const getRuleLegacyId = (rule: PricingRuleConfig) => {
    const raw = (rule.metadata as { legacy_id?: unknown } | null | undefined)?.legacy_id;
    return typeof raw === 'string' && raw.trim() ? raw : undefined;
  };

  const toSelectionKey = (rule: PricingRuleConfig) => rule.key;

  const buildItems = (
    allRules: PricingRuleConfig[],
    selection: Map<string, { selected: boolean; quantity: number; description?: string }>
  ): EquipmentRentalItem[] =>
    allRules.map((rule) => {
      const selectionKey = toSelectionKey(rule);
      const sel = selection.get(selectionKey) ?? {
        selected: false,
        quantity: 0,
        description: undefined,
      };
      const q = sel.selected ? sel.quantity : 0;
      const unitValue = Number(rule.value) || 0;
      const total = q * unitValue;
      return {
        id: selectionKey,
        ruleKey: selectionKey,
        legacyId: getRuleLegacyId(rule),
        name: rule.label,
        code: rule.key,
        unit: getRuleUnit(rule),
        selected: sel.selected,
        quantity: q,
        unitValue,
        total,
        description: sel.description,
      };
    });

  const handleChange = (
    rate: PricingRuleConfig,
    selected: boolean,
    quantity: number,
    description?: string
  ) => {
    if (!sortedRates.length) return;
    const selectionKey = toSelectionKey(rate);
    setSelectionByRate((prev) => {
      const next = new Map(prev);
      if (selected && quantity > 0) {
        const existing = prev.get(selectionKey);
        next.set(selectionKey, {
          selected: true,
          quantity,
          description: description ?? existing?.description,
        });
      } else {
        next.delete(selectionKey);
      }

      const items = buildItems(sortedRates, next);
      const total = items.reduce((s, i) => s + i.total, 0);
      onChange(
        total,
        items.filter((i) => i.selected && i.quantity > 0)
      );
      return next;
    });
  };

  const handleDescriptionChange = (rateId: string, description: string) => {
    if (!sortedRates.length) return;
    setSelectionByRate((prev) => {
      const next = new Map(prev);
      const existing = prev.get(rateId);
      if (existing?.selected) {
        next.set(rateId, { ...existing, description: description || undefined });
      }

      const items = buildItems(sortedRates, next);
      const total = items.reduce((s, i) => s + i.total, 0);
      onChange(
        total,
        items.filter((i) => i.selected && i.quantity > 0)
      );
      return next;
    });
  };

  const computedTotal = useMemo(() => {
    if (!sortedRates.length) return 0;
    return sortedRates.reduce((s, rule) => {
      const sel = selectionByRate.get(toSelectionKey(rule));
      if (!sel?.selected || sel.quantity <= 0) return s;
      return s + sel.quantity * (Number(rule.value) || 0);
    }, 0);
  }, [sortedRates, selectionByRate]);

  if (isLoading || !sortedRates.length) {
    return (
      <div className="space-y-2">
        <Label>Aluguel de Máquinas</Label>
        <div className="text-sm text-muted-foreground">
          {isLoading ? 'Carregando...' : 'Nenhum item cadastrado na tabela.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Aluguel de Máquinas</Label>
      <div className="rounded-md border divide-y">
        {sortedRates.map((rate) => {
          const selectionKey = toSelectionKey(rate);
          const unitValue = Number(rate.value) || 0;
          const unit = getRuleUnit(rate);
          const sel = selectionByRate.get(selectionKey) ?? { selected: false, quantity: 0 };
          const lineTotal = sel.selected && sel.quantity > 0 ? sel.quantity * unitValue : 0;
          return (
            <div
              key={rate.id || `${selectionKey}:${rate.methodology}`}
              className="flex flex-col gap-1 px-3 py-2 bg-background hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={sel.selected}
                  onCheckedChange={(checked) =>
                    handleChange(
                      rate,
                      !!checked,
                      checked ? Math.max(1, sel.quantity) : 0,
                      sel.description
                    )
                  }
                  disabled={readOnly}
                />
                <span className="flex-1 text-sm truncate">{rate.label}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  R$ {unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {unit}
                </span>
                <div className="w-20">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={sel.selected ? sel.quantity : ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      const q = isNaN(v) ? 0 : Math.max(0, v);
                      handleChange(rate, q > 0, q, sel.description);
                    }}
                    placeholder="0"
                    disabled={readOnly || !sel.selected}
                    className="h-8 text-right"
                  />
                </div>
                <span className="w-24 text-right text-sm tabular-nums">
                  R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {sel.selected && (
                <Input
                  placeholder="Descrição (opcional)"
                  value={sel.description ?? ''}
                  onChange={(e) => handleDescriptionChange(selectionKey, e.target.value)}
                  disabled={readOnly}
                  className="h-8 ml-6 text-sm"
                />
              )}
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
