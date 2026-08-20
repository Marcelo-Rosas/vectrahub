import { useEffect, useMemo, useState } from 'react';
import { Box, Layers, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FairQtyStepper } from '@/components/fair/FairQtyStepper';
import { FAIR_UI } from '@/lib/fair-brand-palettes';
import {
  formatBoxDimensionsCm,
  fullKitBoxTypes,
  type ShipperProductCatalogEntry,
} from '@/lib/shipper-product-catalog';
import { cn } from '@/lib/utils';

export type KitPickerResult = {
  sku: string;
  quantity: number;
  selectedBoxTypes: string[];
};

type Props = {
  product: ShipperProductCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: KitPickerResult) => void;
  /** Pré-seleção ao editar linha existente */
  initialBoxTypes?: string[];
  initialQuantity?: number;
};

export function KitVolumePicker({
  product,
  open,
  onOpenChange,
  onConfirm,
  initialBoxTypes,
  initialQuantity = 1,
}: Props) {
  const allTypes = useMemo(() => (product ? fullKitBoxTypes(product) : []), [product]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allTypes));
  const [quantity, setQuantity] = useState(initialQuantity);

  useEffect(() => {
    if (product && open) {
      const types =
        initialBoxTypes && initialBoxTypes.length > 0
          ? initialBoxTypes.filter((t) => allTypes.includes(t))
          : fullKitBoxTypes(product);
      setSelected(new Set(types.length > 0 ? types : allTypes));
      setQuantity(initialQuantity);
    }
  }, [product, open, initialBoxTypes, initialQuantity, allTypes]);

  const setTypeChecked = (boxType: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(boxType);
      else next.delete(boxType);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === allTypes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allTypes));
    }
  };

  const preview = useMemo(() => {
    if (!product) return { weight: 0, volume: 0, boxes: 0 };
    const boxes = product.boxTypes.filter((b) => selected.has(b.boxType));
    return {
      weight: boxes.reduce((s, b) => s + b.groupWeightKg, 0) * quantity,
      volume: boxes.reduce((s, b) => s + b.volumeM3, 0) * quantity,
      boxes: boxes.reduce((s, b) => s + b.boxesPerUnit, 0) * quantity,
    };
  }, [product, selected, quantity]);

  const handleConfirm = () => {
    if (!product || selected.size === 0) return;
    onConfirm({
      sku: product.sku,
      quantity,
      selectedBoxTypes: allTypes.filter((t) => selected.has(t)),
    });
    onOpenChange(false);
  };

  const isMultiVolume = (product?.boxTypes.length ?? 0) > 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'z-[60] flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl border-t-2 border-[color:var(--fair-border)] p-0',
          '[&>button.absolute]:hidden'
        )}
      >
        {product && (
          <>
            <SheetHeader className="shrink-0 space-y-2 px-4 pb-3 pt-2 text-left sm:px-5">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'font-mono text-xs font-semibold tracking-widest',
                      FAIR_UI.accent
                    )}
                  >
                    {product.sku}
                  </p>
                  <SheetTitle className="text-lg leading-snug sm:text-xl">
                    {product.name}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-sm">
                    {isMultiVolume
                      ? `${product.boxesTotal} volumes — toque para incluir na carga`
                      : 'Confirme a quantidade'}
                  </SheetDescription>
                </div>
                <Badge
                  variant="outline"
                  className={cn('shrink-0 px-2 py-1 font-mono text-xs', FAIR_UI.chip)}
                >
                  {selected.size}/{allTypes.length}
                </Badge>
              </div>
            </SheetHeader>

            {isMultiVolume && (
              <div className="flex shrink-0 items-center justify-between border-y bg-muted/30 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium touch-manipulation active:bg-muted',
                    FAIR_UI.accent
                  )}
                  onClick={toggleAll}
                >
                  <Layers className="h-4 w-4" />
                  {selected.size === allTypes.length ? 'Desmarcar todos' : 'Kit completo'}
                </button>
              </div>
            )}

            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              {product.boxTypes.map((box, idx) => {
                const checked = selected.has(box.boxType);
                return (
                  <li key={box.boxType}>
                    <button
                      type="button"
                      onClick={() => setTypeChecked(box.boxType, !checked)}
                      className={cn(
                        'flex w-full min-h-[3.75rem] items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors touch-manipulation active:scale-[0.99]',
                        checked
                          ? cn('border-2 shadow-sm', FAIR_UI.softPanel)
                          : 'border-transparent bg-muted/50'
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        aria-hidden
                        className={cn('pointer-events-none mt-1 h-5 w-5 shrink-0', FAIR_UI.check)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-sm font-bold',
                              FAIR_UI.mark
                            )}
                          >
                            {box.boxType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            vol {idx + 1}/{product.boxTypes.length}
                          </span>
                        </div>
                        <p className="mt-1.5 font-mono text-base tracking-tight">
                          {formatBoxDimensionsCm(box.lengthMm, box.widthMm, box.heightMm)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span>{box.groupWeightKg.toFixed(1)} kg</span>
                          <span>{box.volumeM3.toFixed(2)} m³</span>
                        </div>
                      </div>
                      <Box
                        className={cn(
                          'mt-1 h-5 w-5 shrink-0',
                          checked ? FAIR_UI.accent : 'text-muted-foreground/30'
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="shrink-0 border-t bg-background px-4 pb-safe-bottom pt-3 sm:px-5">
              <div
                className={cn(
                  'mb-3 grid grid-cols-3 gap-1 rounded-xl py-3 text-center text-xs sm:text-sm',
                  FAIR_UI.stats
                )}
              >
                <div>
                  <div className="text-base font-semibold tabular-nums sm:text-lg">
                    {preview.weight.toFixed(0)}
                  </div>
                  <div className="text-muted-foreground">kg</div>
                </div>
                <div>
                  <div className="text-base font-semibold tabular-nums sm:text-lg">
                    {preview.volume.toFixed(2)}
                  </div>
                  <div className="text-muted-foreground">m³</div>
                </div>
                <div>
                  <div className="text-base font-semibold tabular-nums sm:text-lg">
                    {preview.boxes}
                  </div>
                  <div className="text-muted-foreground">caixas</div>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="shrink-0 space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Qtd equip.
                  </Label>
                  <FairQtyStepper value={quantity} onChange={setQuantity} />
                </div>
                <Button
                  className={cn(
                    'h-11 min-h-[2.75rem] flex-1 touch-manipulation text-base sm:h-12',
                    FAIR_UI.cta
                  )}
                  disabled={selected.size === 0}
                  onClick={handleConfirm}
                >
                  <PackagePlus className="mr-2 h-5 w-5 shrink-0" />
                  <span className="truncate">Adicionar</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
