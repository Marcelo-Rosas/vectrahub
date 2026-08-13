import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User, Truck, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateDriver, useUpdateDriver } from '@/hooks/useDrivers';
import { useCreateOwner, useUpdateOwner } from '@/hooks/useOwners';
import { useVehicles } from '@/hooks/useVehicles';
import { useUpdateVehicle } from '@/hooks/useVehicles';
import { useCnhCategories } from '@/hooks/useCnhCategories';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Driver } from '@/hooks/useDrivers';
import { zodPhone, zodRntrcOptional, maskRntrcInput } from '@/lib/validators';
import { anttRegistryToMdfeTipoProprietario } from '@/lib/risk-antt-evidence';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const driverSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
    cpf: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\d{11}$/.test(v.replace(/\D/g, '')),
        'CPF inválido – informe 11 dígitos'
      ),
    phone: zodPhone,
    cnh: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\d{11}$/.test(v.replace(/\D/g, '')),
        'CNH inválida – informe 11 dígitos'
      ),
    cnh_category: z.string().optional(),
    antt: zodRntrcOptional,
    contract_type: z.enum(['proprio', 'agregado', 'terceiro']),
    rntrc_registry_type: z.enum(['TAC', 'ETC'], {
      required_error: 'RNTRC é obrigatório',
      invalid_type_error: 'Selecione TAC ou ETC',
    }),
    is_owner: z.boolean(),
    active: z.boolean(),
    payment_prefer: z.enum(['pix', 'banco', '']).optional(),
    pix_key: z.string().max(60).optional(),
    bank_code: z.string().optional(),
    bank_agency: z.string().max(10).optional(),
    bank_account: z.string().max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.is_owner) return;
    const prefer = data.payment_prefer || '';
    if (!prefer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payment_prefer'],
        message: 'Proprietário: informe PIX ou banco (clone → Owners / MDF-e)',
      });
    }
    if (prefer === 'pix' && !data.pix_key?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pix_key'],
        message: 'Informe a chave PIX',
      });
    }
    if (prefer === 'banco') {
      if (!data.bank_code?.replace(/\D/g, '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bank_code'],
          message: 'Informe o código do banco',
        });
      }
      if (!data.bank_agency?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bank_agency'],
          message: 'Informe a agência',
        });
      }
    }
  });

type DriverFormData = z.infer<typeof driverSchema>;

interface DriverFormProps {
  open: boolean;
  onClose: () => void;
  driver?: Driver | null;
}

export function DriverForm({ open, onClose, driver }: DriverFormProps) {
  const createDriverMutation = useCreateDriver();
  const updateDriverMutation = useUpdateDriver();
  const createOwnerMutation = useCreateOwner();
  const updateOwnerMutation = useUpdateOwner();
  const updateVehicleMutation = useUpdateVehicle();
  const isEditing = !!driver;

  /** Upsert owner por CPF com dados bancários (fonte MDF-e = owners). */
  async function upsertOwnerFromDriver(data: DriverFormData): Promise<string | null> {
    const cpf = (data.cpf || '').replace(/\D/g, '');
    const prefer = data.payment_prefer && data.payment_prefer !== '' ? data.payment_prefer : null;
    const tipoStr = anttRegistryToMdfeTipoProprietario(data.rntrc_registry_type);
    const payload = {
      name: data.name,
      cpf_cnpj: cpf || null,
      phone: data.phone || null,
      rntrc: data.antt && data.antt !== '' ? data.antt : null,
      tipo_proprietario: tipoStr !== '' ? parseInt(tipoStr, 10) : null,
      payment_prefer: prefer,
      pix_key: prefer === 'pix' ? data.pix_key?.trim() || null : null,
      bank_code: prefer === 'banco' ? data.bank_code?.replace(/\D/g, '').slice(0, 5) || null : null,
      bank_agency: prefer === 'banco' ? data.bank_agency?.trim() || null : null,
      bank_account: prefer === 'banco' ? data.bank_account?.trim() || null : null,
      active: true,
    };

    if (cpf.length === 11) {
      const { data: existing } = await supabase
        .from('owners')
        .select('id')
        .eq('cpf_cnpj', cpf)
        .maybeSingle();
      if (existing?.id) {
        await updateOwnerMutation.mutateAsync({
          id: existing.id,
          updates: payload as never,
        });
        return existing.id;
      }
    }

    const created = await createOwnerMutation.mutateAsync(payload as never);
    return created?.id ?? null;
  }

  // Busca veículo(s) vinculado ao motorista (apenas em modo edição)
  const { data: allVehicles } = useVehicles(driver?.id ?? null);
  const linkedVehicles = useMemo(
    () => allVehicles?.filter((v) => v.driver_id === driver?.id) ?? [],
    [allVehicles, driver?.id]
  );

  // Verifica se o motorista já é proprietário de algum veículo vinculado
  const [initialIsOwner, setInitialIsOwner] = useState(false);
  useEffect(() => {
    if (isEditing && linkedVehicles.length > 0) {
      const hasOwnership = linkedVehicles.some((v) => v.owner?.name === driver?.name);
      setInitialIsOwner(hasOwnership);
    }
  }, [isEditing, linkedVehicles, driver?.name]);

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: '',
      cpf: '',
      phone: '',
      cnh: '',
      cnh_category: '',
      antt: '',
      contract_type: 'proprio',
      rntrc_registry_type: undefined as unknown as 'TAC' | 'ETC',
      is_owner: false,
      active: true,
      payment_prefer: '',
      pix_key: '',
      bank_code: '',
      bank_agency: '',
      bank_account: '',
    },
  });

  useEffect(() => {
    if (driver) {
      form.reset({
        name: driver.name,
        cpf: driver.cpf || '',
        phone: driver.phone || '',
        cnh: driver.cnh || '',
        cnh_category: (driver.cnh_category as DriverFormData['cnh_category']) || '',
        antt: driver.antt || '',
        contract_type: driver.contract_type ?? 'proprio',
        rntrc_registry_type: (driver.rntrc_registry_type ?? undefined) as 'TAC' | 'ETC',
        is_owner: initialIsOwner,
        active: driver.active,
        payment_prefer: '',
        pix_key: '',
        bank_code: '',
        bank_agency: '',
        bank_account: '',
      });
    } else {
      form.reset({
        name: '',
        cpf: '',
        phone: '',
        cnh: '',
        cnh_category: '',
        antt: '',
        contract_type: 'proprio',
        rntrc_registry_type: undefined as unknown as 'TAC' | 'ETC',
        is_owner: false,
        active: true,
        payment_prefer: '',
        pix_key: '',
        bank_code: '',
        bank_agency: '',
        bank_account: '',
      });
    }
  }, [driver, form, initialIsOwner]);

  const isOwnerWatch = form.watch('is_owner');
  const payPreferWatch = form.watch('payment_prefer');

  const onSubmit = async (data: DriverFormData) => {
    try {
      if (isEditing && driver) {
        await updateDriverMutation.mutateAsync({
          id: driver.id,
          updates: {
            name: data.name,
            cpf: data.cpf || null,
            phone: data.phone || null,
            cnh: data.cnh || null,
            cnh_category: data.cnh_category || null,
            antt: data.antt || null,
            contract_type: data.contract_type,
            rntrc_registry_type: data.rntrc_registry_type,
            active: data.active,
          },
        });

        if (data.is_owner) {
          try {
            const ownerId = await upsertOwnerFromDriver(data);
            if (ownerId) {
              for (const v of linkedVehicles) {
                if (v.owner_id !== ownerId) {
                  await updateVehicleMutation.mutateAsync({
                    id: v.id,
                    updates: { owner_id: ownerId },
                  });
                }
              }
            }
          } catch (err) {
            toast.error(`Owner clone falhou: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        toast.success('Motorista atualizado com sucesso');
      } else {
        await createDriverMutation.mutateAsync({
          name: data.name,
          cpf: data.cpf || null,
          phone: data.phone || null,
          cnh: data.cnh || null,
          cnh_category: data.cnh_category || null,
          antt: data.antt || null,
          contract_type: data.contract_type,
          rntrc_registry_type: data.rntrc_registry_type,
          active: data.active,
        });
        if (data.is_owner) {
          try {
            await upsertOwnerFromDriver(data);
          } catch {
            /* clone best-effort */
          }
        }
        toast.success('Motorista criado com sucesso');
      }
      onClose();
    } catch {
      toast.error(isEditing ? 'Erro ao atualizar motorista' : 'Erro ao criar motorista');
    }
  };

  const isLoading = createDriverMutation.isPending || updateDriverMutation.isPending;

  const { data: cnhCategories = [] } = useCnhCategories();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] max-h-[96vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {isEditing ? 'Editar Motorista' : 'Novo Motorista'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Cadastre ou atualize dados pessoais, habilitação e status do motorista.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* ── Dados pessoais ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dados pessoais
              </p>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do motorista" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        maxLength={14}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/\D/g, '').slice(0, 11))
                        }
                        value={
                          field.value
                            ? field.value
                                .replace(/\D/g, '')
                                .replace(/(\d{3})(\d)/, '$1.$2')
                                .replace(/(\d{3})(\d)/, '$1.$2')
                                .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
                            : ''
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone / WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Habilitação + ANTT ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Habilitação (CNH) e ANTT
              </p>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="cnh"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da CNH</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="11 dígitos"
                          maxLength={11}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, '').slice(0, 11))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cnh_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        >
                          <option value="">Selecionar...</option>
                          {cnhCategories.map((cat) => (
                            <option key={cat.code} value={cat.code}>
                              {`${cat.code} — ${cat.description}`}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="antt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registro ANTT (RNTRC)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="002353222"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={9}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(maskRntrcInput(e.target.value))}
                        onBlur={(e) => {
                          field.onChange(maskRntrcInput(e.target.value));
                          field.onBlur();
                        }}
                      />
                    </FormControl>
                    <p className="text-[10px] text-muted-foreground">
                      ANTT até 9 digitos. SEFAZ/Focus usa 8 no emit.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de vínculo operacional *</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="proprio">Frota</option>
                        <option value="agregado">Agregado</option>
                        <option value="terceiro">Terceiro</option>
                      </select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Esta definição será usada na consulta ANTT do Step 1 do risco.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rntrc_registry_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registro RNTRC (TAC/ETC) *</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      >
                        <option value="">Selecione…</option>
                        <option value="TAC">TAC</option>
                        <option value="ETC">ETC</option>
                      </select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Obrigatório. Define se o motorista é Transportador Autônomo (TAC) ou vinculado
                      a Empresa de Transporte (ETC) — usado para regra de CIOT.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Proprietário + pagamento (clone → owners / MDF-e) ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Proprietário
              </p>
              <FormField
                control={form.control}
                name="is_owner"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-md border border-input p-3 bg-muted/30">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="leading-none">
                      <FormLabel className="font-normal cursor-pointer">
                        Motorista é proprietário do veículo
                      </FormLabel>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Clona CPF, RNTRC e dados bancários para Owners (MDF-e infPag).
                        {isEditing && linkedVehicles.length > 0
                          ? ' Vincula aos veículos deste motorista.'
                          : ''}
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              {isOwnerWatch && (
                <div className="space-y-3 rounded-md border border-dashed border-input p-3">
                  <p className="text-[10px] text-muted-foreground">
                    Pagamento frete (SEFAZ 302) — gravado em Owners
                  </p>
                  <FormField
                    control={form.control}
                    name="payment_prefer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma *</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione…" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">Selecione…</span>
                            </SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="banco">Banco + agência</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {payPreferWatch === 'pix' && (
                    <FormField
                      control={form.control}
                      name="pix_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX *</FormLabel>
                          <FormControl>
                            <Input placeholder="chave PIX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {payPreferWatch === 'banco' && (
                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name="bank_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Banco *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="001"
                                maxLength={5}
                                {...field}
                                onChange={(e) =>
                                  field.onChange(e.target.value.replace(/\D/g, '').slice(0, 5))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bank_agency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agência *</FormLabel>
                            <FormControl>
                              <Input placeholder="1234" maxLength={10} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bank_account"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conta</FormLabel>
                            <FormControl>
                              <Input placeholder="opcional" maxLength={20} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Veículos vinculados (só em edição) ── */}
            {isEditing && linkedVehicles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  Veículos vinculados
                </p>
                <div className="flex flex-wrap gap-2">
                  {linkedVehicles.map((v) => (
                    <Badge key={v.id} variant="secondary" className="font-mono text-sm gap-1.5">
                      <Truck className="w-3 h-3" />
                      {v.plate}
                      {v.brand && v.model ? ` · ${v.brand} ${v.model}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* ── Status ── */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-md border border-input p-3 bg-muted/30">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="leading-none">
                    <FormLabel className="font-normal cursor-pointer">Motorista ativo</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Motoristas inativos não aparecem nas seleções de cotação e OS
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Criar Motorista'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
