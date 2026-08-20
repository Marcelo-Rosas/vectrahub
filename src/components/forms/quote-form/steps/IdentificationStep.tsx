import { useCallback, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCepData } from '@/hooks/useCepLookup';
import { formatCityUfFromCep, sanitizeCep } from '@/lib/cep-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { MaskedInput } from '@/components/ui/masked-input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import type { QuoteFormData } from '../types';
import { SectionBlock } from '@/components/ui/section-block';

interface VehicleType {
  id: string;
  name: string;
  code: string;
}

interface IdentificationStepProps {
  form: UseFormReturn<QuoteFormData>;
  clients: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  shippers: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  vehicleTypes: VehicleType[];
  isLegacy?: boolean;
  onClientSelect: (clientId: string) => void;
  onShipperSelect: (shipperId: string) => void;
  onOriginCepBlur: () => Promise<void>;
  onDestinationCepBlur: () => Promise<void>;
  onCalculateKm: () => Promise<void>;
  onOriginManualEdit?: () => void;
  onDestinationManualEdit?: () => void;
  isLoadingOriginCep: boolean;
  isLoadingDestinationCep: boolean;
  isCalculatingKm: boolean;
}

export function IdentificationStep({
  form,
  clients,
  shippers,
  vehicleTypes,
  isLegacy = false,
  onClientSelect,
  onShipperSelect,
  onOriginCepBlur,
  onDestinationCepBlur,
  onCalculateKm,
  onOriginManualEdit,
  onDestinationManualEdit,
  isLoadingOriginCep,
  isLoadingDestinationCep,
  isCalculatingKm,
}: IdentificationStepProps) {
  const {
    fields: recipientFields,
    append: appendRecipient,
    remove: removeRecipient,
  } = useFieldArray({
    control: form.control,
    name: 'additional_recipients',
  });
  const {
    fields: shipperFields,
    append: appendShipper,
    remove: removeShipper,
  } = useFieldArray({
    control: form.control,
    name: 'additional_shippers',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'route_stops',
  });

  const clientCount = 1 + recipientFields.length;
  const shipperCount = 1 + shipperFields.length;
  const showEntregasIntermediarias = clientCount > 1;
  const freightType = form.watch('freight_type');
  const isCif =
    String(freightType ?? '')
      .trim()
      .toUpperCase() === 'CIF';
  const showContractSplit = isCif ? shipperCount > 1 : clientCount > 1;

  useEffect(() => {
    if (!showEntregasIntermediarias) {
      const stops = form.getValues('route_stops') ?? [];
      if (stops.length > 0) {
        form.setValue('route_stops', [], { shouldDirty: true });
      }
    }
  }, [showEntregasIntermediarias, form]);

  const fillPickupCityFromCep = useCallback(
    async (index: number, cepRaw?: string) => {
      const cep = sanitizeCep(cepRaw ?? form.getValues(`additional_shippers.${index}.cep`) ?? '');
      if (cep.length !== 8) return;
      try {
        const data = await fetchCepData(cep);
        if (!data) {
          toast.error('CEP da coleta não encontrado');
          return;
        }
        const cityUf = formatCityUfFromCep(data);
        if (cityUf.length >= 2) {
          form.setValue(`additional_shippers.${index}.city_uf`, cityUf, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
      } catch {
        toast.error('Erro ao buscar CEP da coleta');
      }
    },
    [form]
  );

  return (
    <div className="space-y-6">
      <SectionBlock
        variant="card"
        label="Dados do Cliente"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendRecipient({ client_id: '', name: '' })}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar destinatário
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente Existente</FormLabel>
                  <Select onValueChange={(value) => onClientSelect(value)} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar cliente..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="cliente@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="client_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Cliente *</FormLabel>
                <FormControl>
                  <Input placeholder="Nome ou razão social" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {recipientFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Com mais de um destinatário, informe as entregas intermediárias na seção Rota.
            </p>
          )}
          <div className="space-y-2">
            {recipientFields.length > 0 && (
              <span className="text-sm font-medium text-muted-foreground">
                Destinatários adicionais
              </span>
            )}
            {recipientFields.map((rf, idx) => {
              const mainClientId = form.watch('client_id');
              const otherRecipientIds = (form.watch('additional_recipients') ?? [])
                .map((r) => (r as { client_id?: string }).client_id)
                .filter((id, i) => i !== idx && !!id);
              const excludedIds = new Set([mainClientId, ...otherRecipientIds].filter(Boolean));
              const availableClients = clients.filter((c) => !excludedIds.has(c.id));
              return (
                <div
                  key={rf.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-3 bg-muted/20"
                >
                  <FormField
                    control={form.control}
                    name={`additional_recipients.${idx}.client_id`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-0">
                        <FormLabel className="text-xs text-muted-foreground">Cliente</FormLabel>
                        <Select
                          value={f.value || ''}
                          onValueChange={(value) => {
                            f.onChange(value);
                            const selected = clients.find((c) => c.id === value);
                            if (selected) {
                              form.setValue(`additional_recipients.${idx}.name`, selected.name, {
                                shouldDirty: true,
                              });
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecionar cliente..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableClients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive self-end"
                    onClick={() => removeRecipient(idx)}
                    title="Remover destinatário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        variant="card"
        label="Embarcador"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendShipper({ shipper_id: '', name: '', email: '', cep: '', city_uf: '' })
            }
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar embarcador
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shipper_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Embarcador Existente</FormLabel>
                  <Select onValueChange={(value) => onShipperSelect(value)} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar embarcador..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {shippers.map((shipper) => (
                        <SelectItem key={shipper.id} value={shipper.id}>
                          {shipper.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipper_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail Embarcador</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="embarcador@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shipper_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Embarcador</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome ou razão social" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="freight_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Frete *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FOB" title="Frete por conta do destinatário">
                        FOB
                      </SelectItem>
                      <SelectItem value="CIF" title="Frete por conta do remetente">
                        CIF
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {shipperFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Informe o CEP de cada coleta adicional para incluir no cálculo de km.
            </p>
          )}
          <div className="space-y-2">
            {shipperFields.length > 0 && (
              <span className="text-sm font-medium text-muted-foreground">
                Coletas em outros embarcadores
              </span>
            )}
            {shipperFields.map((sf, idx) => {
              const mainShipperId = form.watch('shipper_id');
              const otherShipperIds = (form.watch('additional_shippers') ?? [])
                .map((s) => (s as { shipper_id?: string }).shipper_id)
                .filter((id, i) => i !== idx && !!id);
              const excludedIds = new Set([mainShipperId, ...otherShipperIds].filter(Boolean));
              const availableShippers = shippers.filter((s) => !excludedIds.has(s.id));
              return (
                <div
                  key={sf.id}
                  className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3 bg-muted/20"
                >
                  <FormField
                    control={form.control}
                    name={`additional_shippers.${idx}.shipper_id`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-[160px]">
                        <FormLabel className="text-xs text-muted-foreground">Embarcador</FormLabel>
                        <Select
                          value={f.value || ''}
                          onValueChange={(value) => {
                            f.onChange(value);
                            const selected = shippers.find((s) => s.id === value);
                            if (selected) {
                              form.setValue(`additional_shippers.${idx}.name`, selected.name, {
                                shouldDirty: true,
                              });
                              form.setValue(
                                `additional_shippers.${idx}.email`,
                                selected.email || '',
                                { shouldDirty: true }
                              );
                              if (selected.zip_code) {
                                const cep = sanitizeCep(selected.zip_code);
                                form.setValue(`additional_shippers.${idx}.cep`, cep, {
                                  shouldDirty: true,
                                });
                                void fillPickupCityFromCep(idx, cep);
                              }
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecionar embarcador..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableShippers.map((shipper) => (
                              <SelectItem key={shipper.id} value={shipper.id}>
                                {shipper.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`additional_shippers.${idx}.cep`}
                    render={({ field: f }) => (
                      <FormItem className="w-[120px] shrink-0">
                        <FormLabel className="text-xs text-muted-foreground">CEP coleta</FormLabel>
                        <FormControl>
                          <MaskedInput
                            mask="cep"
                            placeholder="00000-000"
                            value={f.value || ''}
                            onValueChange={(rawValue) => {
                              const digits = String(rawValue ?? '');
                              f.onChange(digits);
                              if (digits.replace(/\D/g, '').length === 8) {
                                void fillPickupCityFromCep(idx, digits);
                              }
                            }}
                            onBlur={() => {
                              f.onBlur();
                              void fillPickupCityFromCep(idx);
                            }}
                            className="h-9"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`additional_shippers.${idx}.city_uf`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-[140px]">
                        <FormLabel className="text-xs text-muted-foreground">Cidade - UF</FormLabel>
                        <FormControl>
                          <Input placeholder="Cidade - UF" {...f} className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeShipper(idx)}
                    aria-label="Remover embarcador"
                    title="Remover embarcador"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </SectionBlock>

      {showContractSplit && (
        <SectionBlock variant="card" label="Rateio do contrato (multi-pagador)">
          <p className="text-xs text-muted-foreground mb-4">
            {isCif
              ? 'CIF: um CTR por embarcador. Informe peso/valor por pagador ou valor líquido manual de cada perna.'
              : 'FOB: um CTR por destinatário. Informe peso/valor por pagador ou valor líquido manual de cada perna.'}
          </p>
          <div className="space-y-3">
            {isCif ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg border border-border p-3 bg-muted/20">
                  <span className="sm:col-span-4 text-sm font-medium truncate">
                    {form.watch('shipper_name') || 'Embarcador principal'}
                  </span>
                  <FormField
                    control={form.control}
                    name="shipper_leg_weight_kg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Peso (kg)</FormLabel>
                        <FormControl>
                          <NumericInput
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? undefined)}
                            placeholder="0"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shipper_leg_cargo_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor carga (R$)</FormLabel>
                        <FormControl>
                          <NumericInput
                            prefix="R$ "
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? undefined)}
                            placeholder="0,00"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shipper_leg_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor CTR (R$)</FormLabel>
                        <FormControl>
                          <NumericInput
                            prefix="R$ "
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? undefined)}
                            placeholder="Opcional"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {shipperFields.map((sf, idx) => (
                  <div
                    key={sf.id}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg border border-border p-3 bg-muted/20"
                  >
                    <span className="sm:col-span-4 text-sm font-medium truncate">
                      {form.watch(`additional_shippers.${idx}.name`) || `Embarcador ${idx + 2}`}
                    </span>
                    <FormField
                      control={form.control}
                      name={`additional_shippers.${idx}.weight_kg`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Peso (kg)</FormLabel>
                          <FormControl>
                            <NumericInput
                              value={field.value}
                              onValueChange={(v) => field.onChange(v ?? undefined)}
                              placeholder="0"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`additional_shippers.${idx}.cargo_value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Valor carga (R$)</FormLabel>
                          <FormControl>
                            <NumericInput
                              prefix="R$ "
                              value={field.value}
                              onValueChange={(v) => field.onChange(v ?? undefined)}
                              placeholder="0,00"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`additional_shippers.${idx}.leg_amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Valor CTR (R$)</FormLabel>
                          <FormControl>
                            <NumericInput
                              prefix="R$ "
                              value={field.value}
                              onValueChange={(v) => field.onChange(v ?? undefined)}
                              placeholder="Opcional"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg border border-border p-3 bg-muted/20">
                  <span className="sm:col-span-4 text-sm font-medium truncate">
                    {form.watch('client_name') || 'Cliente principal'}
                  </span>
                  <FormField
                    control={form.control}
                    name="client_leg_weight_kg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Peso (kg)</FormLabel>
                        <FormControl>
                          <NumericInput
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? undefined)}
                            placeholder="0"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_leg_cargo_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor carga (R$)</FormLabel>
                        <FormControl>
                          <NumericInput
                            prefix="R$ "
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? undefined)}
                            placeholder="0,00"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_leg_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Valor CTR (R$)</FormLabel>
                        <FormControl>
                          <NumericInput
                            prefix="R$ "
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? undefined)}
                            placeholder="Opcional"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {recipientFields.map((rf, idx) => (
                  <div
                    key={rf.id}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg border border-border p-3 bg-muted/20"
                  >
                    <span className="sm:col-span-4 text-sm font-medium truncate">
                      {form.watch(`additional_recipients.${idx}.name`) || `Destinatário ${idx + 2}`}
                    </span>
                    <FormField
                      control={form.control}
                      name={`additional_recipients.${idx}.weight_kg`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Peso (kg)</FormLabel>
                          <FormControl>
                            <NumericInput
                              value={field.value}
                              onValueChange={(v) => field.onChange(v ?? undefined)}
                              placeholder="0"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`additional_recipients.${idx}.cargo_value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Valor carga (R$)</FormLabel>
                          <FormControl>
                            <NumericInput
                              prefix="R$ "
                              value={field.value}
                              onValueChange={(v) => field.onChange(v ?? undefined)}
                              placeholder="0,00"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`additional_recipients.${idx}.leg_amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Valor CTR (R$)</FormLabel>
                          <FormControl>
                            <NumericInput
                              prefix="R$ "
                              value={field.value}
                              onValueChange={(v) => field.onChange(v ?? undefined)}
                              placeholder="Opcional"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </SectionBlock>
      )}

      <SectionBlock variant="card" label="Rota">
        <div className="space-y-6">
          {!isLegacy && (
            <FormField
              control={form.control}
              name="vehicle_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Veículo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar veículo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vehicleTypes.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} ({vehicle.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-w-0">
            <FormField
              control={form.control}
              name="origin_cep"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP Origem</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MaskedInput
                        mask="cep"
                        placeholder="00000-000"
                        value={field.value || ''}
                        onValueChange={(rawValue) => {
                          const digits = String(rawValue ?? '');
                          field.onChange(digits);
                          if (digits.replace(/\D/g, '').length === 8) {
                            void onOriginCepBlur();
                          }
                        }}
                        onBlur={() => {
                          field.onBlur();
                          void onOriginCepBlur();
                        }}
                        disabled={isLoadingOriginCep}
                      />
                      {isLoadingOriginCep && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destination_cep"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP Destino</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MaskedInput
                        mask="cep"
                        placeholder="00000-000"
                        value={field.value || ''}
                        onValueChange={(rawValue) => {
                          const digits = String(rawValue ?? '');
                          field.onChange(digits);
                          if (digits.replace(/\D/g, '').length === 8) {
                            void onDestinationCepBlur();
                          }
                        }}
                        onBlur={() => {
                          field.onBlur();
                          void onDestinationCepBlur();
                        }}
                        disabled={isLoadingDestinationCep}
                      />
                      {isLoadingDestinationCep && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-w-0">
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Cidade - UF"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        onOriginManualEdit?.();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destino *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Cidade - UF"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        onDestinationManualEdit?.();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Entregas intermediárias — só quando há 2+ destinatários */}
          {showEntregasIntermediarias && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Entregas intermediárias
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ sequence: fields.length + 1, cep: '', city_uf: '' })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar entrega
                </Button>
              </div>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 bg-muted/30"
                >
                  <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                  <FormField
                    control={form.control}
                    name={`route_stops.${index}.cep`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-[100px]">
                        <FormControl>
                          <MaskedInput
                            mask="cep"
                            placeholder="CEP"
                            value={f.value || ''}
                            onValueChange={(rawValue) => f.onChange(String(rawValue ?? ''))}
                            onBlur={f.onBlur}
                            className="h-9"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`route_stops.${index}.city_uf`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-[140px]">
                        <FormControl>
                          <Input placeholder="Cidade - UF" {...f} className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    title="Remover parada"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-muted/30 border border-dashed px-4 py-3">
            <p className="text-xs text-muted-foreground leading-snug">
              Preencha origem e destino, selecione o veículo e calcule a distância para liberar a
              precificação.
            </p>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="shrink-0"
              onClick={onCalculateKm}
              disabled={
                isCalculatingKm ||
                isLoadingOriginCep ||
                isLoadingDestinationCep ||
                !form.watch('origin')?.trim() ||
                !form.watch('destination')?.trim() ||
                (!isLegacy && !form.watch('vehicle_type_id'))
              }
            >
              {isCalculatingKm && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Calcular KM
            </Button>
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
