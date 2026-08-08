import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useCreateOwner, useUpdateOwner } from '@/hooks/useOwners';
import { useAnttRntrcCheck } from '@/hooks/useAnttRntrcCheck';
import {
  resolveAnttRegistryType,
  parseAnttMunicipioUf,
  anttRegistryToMdfeTipoProprietario,
  stripAnttTransportadorPrefix,
} from '@/lib/risk-antt-evidence';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { zodCpfOrCnpj, zodPhone, zodCep, zodRntrcOptional, maskRntrcInput } from '@/lib/validators';

type Owner = Database['public']['Tables']['owners']['Row'];

const ownerSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
    cpf_cnpj: zodCpfOrCnpj,
    rg: z.string().optional(),
    rg_emitter: z.string().optional(),
    phone: zodPhone,
    email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z
      .string()
      .max(2, 'Use a sigla do estado (ex: SP)')
      .optional()
      .transform((v) => v?.toUpperCase()),
    zip_code: zodCep,
    notes: z.string().max(500, 'Observações muito longas').optional(),
    active: z.boolean(),
    // ── Dados ANTT / MDF-e (proprietário do veículo) — Focus infProp ──
    rntrc: zodRntrcOptional,
    uf: z
      .string()
      .max(2, 'Use a sigla da UF (ex: SC)')
      .optional()
      .transform((v) => v?.toUpperCase()),
    tipo_proprietario: z.string().optional(),
    // ── Pagamento frete (MDF-e infPag / SEFAZ 302-303) ──
    payment_prefer: z.union([z.literal('pix'), z.literal('banco'), z.literal('')]).optional(),
    pix_key: z.string().max(60, 'PIX no máximo 60 caracteres').optional(),
    bank_code: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{3,5}$/.test(v.replace(/\D/g, '')), 'Banco: 3 a 5 dígitos'),
    bank_agency: z.string().max(10).optional(),
    bank_account: z.string().max(20).optional(),
  })
  .superRefine((data, ctx) => {
    // Terceiro com tipo ANTT → RNTRC 8 dígitos obrigatório (grupo prop MDF-e)
    if (data.tipo_proprietario?.trim() && (!data.rntrc || data.rntrc === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rntrc'],
        message: 'RNTRC obrigatório quando tipo de proprietário está preenchido (MDF-e)',
      });
    }
    const prefer = data.payment_prefer || '';
    const needsPay =
      data.tipo_proprietario === '0' ||
      data.tipo_proprietario === '1' ||
      Boolean(data.rntrc?.trim());
    if (needsPay && !prefer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payment_prefer'],
        message: 'TAC/RNTRC: informe PIX ou banco (MDF-e pagamento)',
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

type OwnerFormData = z.infer<typeof ownerSchema>;

// Tabela ANTT — tipo de proprietário (MDF-e)
const TIPO_PROPRIETARIO_OPTIONS = [
  { value: '0', label: '0 — TAC Agregado' },
  { value: '1', label: '1 — TAC Independente' },
  { value: '2', label: '2 — Outros' },
] as const;

/** Colunas ANTT/MDF-e / pagamento ainda não nos tipos gerados — cast. */
type OwnerMdfeColumns = {
  rntrc?: string | null;
  uf?: string | null;
  tipo_proprietario?: number | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  pix_key?: string | null;
  payment_prefer?: string | null;
};

type OwnerInsert = Database['public']['Tables']['owners']['Insert'];
type OwnerUpdate = Database['public']['Tables']['owners']['Update'];

/** Campos ANTT/MDF-e + pagamento do form → payload do banco. */
function ownerMdfePayload(data: OwnerFormData): OwnerMdfeColumns {
  const rntrc = data.rntrc && data.rntrc !== '' ? data.rntrc : null;
  const prefer =
    data.payment_prefer === 'pix' || data.payment_prefer === 'banco' ? data.payment_prefer : null;
  return {
    rntrc,
    uf: data.uf?.trim() || null,
    tipo_proprietario:
      data.tipo_proprietario && data.tipo_proprietario.trim() !== ''
        ? parseInt(data.tipo_proprietario, 10)
        : null,
    payment_prefer: prefer,
    pix_key: prefer === 'pix' ? data.pix_key?.trim() || null : null,
    bank_code: prefer === 'banco' ? data.bank_code?.replace(/\D/g, '').slice(0, 5) || null : null,
    bank_agency: prefer === 'banco' ? data.bank_agency?.trim() || null : null,
    bank_account: prefer === 'banco' ? data.bank_account?.trim() || null : null,
  };
}

/** Form keys that hold string values (excludes `active`), for safeSet from CNPJ lookup. */
type OwnerFormStringKey = Exclude<keyof OwnerFormData, 'active'>;

interface OwnerFormProps {
  open: boolean;
  onClose: () => void;
  owner?: Owner | null;
}

export function OwnerForm({ open, onClose, owner }: OwnerFormProps) {
  const createOwnerMutation = useCreateOwner();
  const updateOwnerMutation = useUpdateOwner();
  const anttCheck = useAnttRntrcCheck();
  const isEditing = !!owner;
  const [isLookingUp, setIsLookingUp] = useState(false);

  const form = useForm<OwnerFormData>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      name: '',
      cpf_cnpj: '',
      rg: '',
      rg_emitter: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      notes: '',
      active: true,
      rntrc: '',
      uf: '',
      tipo_proprietario: '',
      payment_prefer: '',
      pix_key: '',
      bank_code: '',
      bank_agency: '',
      bank_account: '',
    },
  });

  useEffect(() => {
    const mdfe = owner ? (owner as unknown as OwnerMdfeColumns) : null;
    if (owner && mdfe) {
      form.reset({
        name: owner.name,
        cpf_cnpj: owner.cpf_cnpj || '',
        rg: owner.rg || '',
        rg_emitter: owner.rg_emitter || '',
        phone: owner.phone || '',
        email: owner.email || '',
        address: owner.address || '',
        city: owner.city || '',
        state: owner.state || '',
        zip_code: owner.zip_code || '',
        notes: owner.notes || '',
        active: owner.active,
        rntrc: mdfe.rntrc || '',
        uf: mdfe.uf || '',
        tipo_proprietario: mdfe.tipo_proprietario != null ? String(mdfe.tipo_proprietario) : '',
        payment_prefer: (mdfe.payment_prefer as 'pix' | 'banco' | '') || '',
        pix_key: mdfe.pix_key || '',
        bank_code: mdfe.bank_code || '',
        bank_agency: mdfe.bank_agency || '',
        bank_account: mdfe.bank_account || '',
      });
    } else {
      form.reset({
        name: '',
        cpf_cnpj: '',
        rg: '',
        rg_emitter: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        notes: '',
        active: true,
        rntrc: '',
        uf: '',
        tipo_proprietario: '',
        payment_prefer: '',
        pix_key: '',
        bank_code: '',
        bank_agency: '',
        bank_account: '',
      });
    }
  }, [owner, form]);

  const sanitizeCnpj = (v: string) => v.replace(/\D/g, '');

  const safeSet = (key: OwnerFormStringKey, value?: unknown) => {
    const str = value != null ? String(value).trim() : '';
    if (!str) return;
    const current = form.getValues(key);
    if (typeof current === 'string' && current.trim().length > 0) return;
    form.setValue(key, str, { shouldValidate: true, shouldDirty: true });
  };

  /** Mesma pipeline do Risk: antt-rntrc-check → UF + tipo MDF-e + RNTRC. */
  const handleAnttLookup = async () => {
    const cpfCnpj = sanitizeCnpj(form.getValues('cpf_cnpj') ?? '');
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      toast.error('Informe CPF (11) ou CNPJ (14) para consultar ANTT');
      return;
    }
    try {
      // Placa do 1º veículo do owner melhora hit no portal (smoke homolog usa placa).
      let vehiclePlate: string | undefined;
      if (owner?.id) {
        const { data: veh } = await supabase
          .from('vehicles')
          .select('plate')
          .eq('owner_id', owner.id)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (veh?.plate) vehiclePlate = String(veh.plate).replace(/[^A-Z0-9]/gi, '');
      }

      // NÃO enviar rntrc do form: máscara/SEFAZ 8 dig ≠ ANTT 9 dig (ex. 02353222 vs 002353222)
      // e portal devolve indeterminado. CPF (+ placa) basta; RNTRC vem na resposta.
      const resp = await anttCheck.mutateAsync({
        order_id: owner?.id ? `owner:${owner.id}` : 'owner-lookup',
        cpf_cnpj: cpfCnpj,
        vehicle_plate: vehiclePlate,
        operation: vehiclePlate ? 'veiculo' : 'rntrc',
      });

      if (resp.situacao === 'indeterminado') {
        toast.warning(resp.message || 'Consulta ANTT indeterminada');
        return;
      }
      if (resp.situacao === 'irregular') {
        toast.error(
          `ANTT irregular: ${resp.situacao_raw ?? resp.situacao}. Confira CPF/CNPJ no portal.`
        );
      }

      const registry = resolveAnttRegistryType({
        rntrc_registry_type: resp.rntrc_registry_type ?? null,
        transportador: resp.transportador ?? null,
      });
      const { municipio, uf } = parseAnttMunicipioUf(resp.municipio_uf);
      const tipoProp = anttRegistryToMdfeTipoProprietario(registry);
      // Guarda RNTRC como o portal devolve (8 ou 9 dig). SEFAZ normaliza no emit.
      const rntrcAntt = resp.rntrc ? maskRntrcInput(String(resp.rntrc)) : '';
      if (rntrcAntt && rntrcAntt !== 'ISENTO') {
        form.setValue('rntrc', rntrcAntt, { shouldDirty: true, shouldValidate: true });
      }
      if (uf) {
        form.setValue('uf', uf, { shouldDirty: true, shouldValidate: true });
      }
      if (tipoProp) {
        form.setValue('tipo_proprietario', tipoProp, { shouldDirty: true, shouldValidate: true });
      }
      // Município ANTT → city se vazio
      if (municipio && !form.getValues('city')?.trim()) {
        form.setValue('city', municipio, { shouldDirty: true });
      }
      // Nome do transportador se form vazio
      const nomeAntt = stripAnttTransportadorPrefix(resp.transportador);
      if (nomeAntt && !form.getValues('name')?.trim()) {
        form.setValue('name', nomeAntt.slice(0, 200), { shouldDirty: true, shouldValidate: true });
      }

      if (resp.situacao === 'regular') {
        toast.success(
          `ANTT OK${registry ? ` · ${registry}` : ''}${uf ? ` · UF ${uf}` : ''}${
            resp.is_stub ? ' (stub)' : ''
          }`
        );
      }
    } catch (err) {
      toast.error(`Erro ANTT: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCnpjLookup = async (rawValue?: string) => {
    const raw = rawValue ?? form.getValues('cpf_cnpj') ?? '';
    const cnpj = sanitizeCnpj(raw);
    if (cnpj.length !== 14) return;

    setIsLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) {
        setIsLookingUp(false);
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;

      safeSet('name', data.razao_social || data.nome_fantasia || data.name);
      safeSet('email', data.email || data.email_contato);
      safeSet('phone', data.ddd_telefone_1 || data.telefone || data.phone);

      const street = data.logradouro || data.endereco || data.street;
      const number = data.numero || data.number;
      const district = data.bairro || data.distrito || data.neighborhood;
      const composedAddress = [street, number, district].filter(Boolean).join(', ');
      safeSet('address', composedAddress);

      safeSet('city', data.municipio || data.cidade || data.city);

      const uf = (data.uf || data.estado || data.state || '').toString().toUpperCase();
      safeSet('state', uf?.slice(0, 2));

      const cep = (data.cep || data.codigo_postal || data.zip_code || '').toString();
      safeSet('zip_code', cep);

      toast.success('Dados preenchidos automaticamente pelo CNPJ');
    } catch {
      // API pode estar indisponível
    } finally {
      setIsLookingUp(false);
    }
  };

  const onSubmit = async (data: OwnerFormData) => {
    try {
      if (isEditing && owner) {
        await updateOwnerMutation.mutateAsync({
          id: owner.id,
          updates: {
            name: data.name,
            cpf_cnpj: data.cpf_cnpj ? data.cpf_cnpj.replace(/\D/g, '') : null,
            rg: data.rg || null,
            rg_emitter: data.rg_emitter || null,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zip_code: data.zip_code || null,
            notes: data.notes || null,
            active: data.active,
            ...ownerMdfePayload(data),
          } as unknown as OwnerUpdate,
        });
        toast.success('Proprietário atualizado com sucesso');
      } else {
        await createOwnerMutation.mutateAsync({
          name: data.name,
          cpf_cnpj: data.cpf_cnpj ? data.cpf_cnpj.replace(/\D/g, '') : null,
          rg: data.rg || null,
          rg_emitter: data.rg_emitter || null,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip_code: data.zip_code || null,
          notes: data.notes || null,
          active: data.active,
          ...ownerMdfePayload(data),
        } as unknown as OwnerInsert);
        toast.success('Proprietário criado com sucesso');
      }
      onClose();
    } catch {
      toast.error(isEditing ? 'Erro ao atualizar proprietário' : 'Erro ao criar proprietário');
    }
  };

  const isLoading =
    createOwnerMutation.isPending || updateOwnerMutation.isPending || anttCheck.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[96vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Proprietário' : 'Novo Proprietário'}</DialogTitle>
          <DialogDescription className="sr-only">
            Cadastre ou edite dados pessoais e de contato do proprietário do veículo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome / Razão Social *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome ou empresa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="00.000.000/0000-00 ou CPF"
                          {...field}
                          onBlur={async (e) => {
                            field.onBlur();
                            await handleCnpjLookup();
                          }}
                          className="pr-10"
                        />
                        {isLookingUp && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        {!isLookingUp && field.value && sanitizeCnpj(field.value).length === 14 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Search className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RG</FormLabel>
                    <FormControl>
                      <Input placeholder="RG" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="rg_emitter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Órgão emissor do RG</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: SSP/SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, número, bairro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input placeholder="SC" maxLength={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zip_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input placeholder="00000-000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informações adicionais..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* ── Dados ANTT / MDF-e ── */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dados ANTT / MDF-e
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Consulta portal ANTT (mesma do risco) preenche RNTRC, UF e Tipo.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8"
                  disabled={anttCheck.isPending || isLookingUp}
                  onClick={() => void handleAnttLookup()}
                >
                  {anttCheck.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Consultar ANTT
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="rntrc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RNTRC (Focus/SEFAZ)</FormLabel>
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
                        ANTT até 9 dig (ex. 002353222). Emit SEFAZ corta p/ 8. Vazio = omite prop.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF (ANTT)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SC"
                          maxLength={2}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipo_proprietario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                        value={field.value || '__none__'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Nenhum</span>
                          </SelectItem>
                          {TIPO_PROPRIETARIO_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pagamento frete (MDF-e)
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  SEFAZ 302/303 — PIX ou banco+agência (Focus infPag). Obrigatório p/ TAC.
                </p>
              </div>
              <FormField
                control={form.control}
                name="payment_prefer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma</FormLabel>
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
                          <span className="text-muted-foreground">Não informado</span>
                        </SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="banco">Banco + agência</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch('payment_prefer') === 'pix' && (
                <FormField
                  control={form.control}
                  name="pix_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chave PIX *</FormLabel>
                      <FormControl>
                        <Input placeholder="CPF, e-mail, telefone ou chave aleatória" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {form.watch('payment_prefer') === 'banco' && (
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="bank_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="001"
                            inputMode="numeric"
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

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Ativo</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Proprietário'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
