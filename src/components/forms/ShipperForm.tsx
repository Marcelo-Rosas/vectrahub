import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Search, AlertTriangle } from 'lucide-react';
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
import { useShippers, useCreateShipper, useUpdateShipper } from '@/hooks/useShippers';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { zodCpf, zodCnpj, zodPhone, zodCep } from '@/lib/validators';
import { MaskedInput } from '@/components/ui/masked-input';
import { CnpjLookupError, lookupCnpj, pickLegalRepresentative } from '@/lib/cnpjLookup';
import { IeLookupError, lookupIe } from '@/lib/ieLookup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Shipper = Database['public']['Tables']['shippers']['Row'];

const digits = (v: string) => v.replace(/\D/g, '');

const shipperSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  contact_name: z.string().max(200, 'Nome muito longo').optional(),
  cpf: zodCpf,
  cnpj: zodCnpj,
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: zodPhone,
  address: z.string().optional(),
  city: z.string().optional(),
  state: z
    .string()
    .max(2, 'Use a sigla do estado (ex: SP)')
    .optional()
    .transform((v) => v?.toUpperCase()),
  zip_code: zodCep,
  notes: z.string().max(500, 'Observações muito longas').optional(),
  // Dados para contrato
  state_registration: z.string().max(30).optional(),
  ie_indicator: z.coerce.number().int().optional(),
  legal_representative_name: z.string().max(200).optional(),
  legal_representative_cpf: z.string().max(20).optional(),
  legal_representative_role: z.string().max(100).optional(),
});

type ShipperFormData = z.infer<typeof shipperSchema>;

interface ShipperFormProps {
  open: boolean;
  onClose: () => void;
  shipper?: Shipper | null;
  /** When the user picks an existing shipper from the name autocomplete during
   * "Novo Embarcador", this callback is invoked. The parent should typically
   * close this dialog and reopen it in edit mode for the chosen shipper. */
  onSelectExisting?: (existing: Shipper) => void;
}

export function ShipperForm({ open, onClose, shipper, onSelectExisting }: ShipperFormProps) {
  const { user } = useAuth();
  const createShipperMutation = useCreateShipper();
  const updateShipperMutation = useUpdateShipper();
  const isEditing = !!shipper;
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isLookingUpIe, setIsLookingUpIe] = useState(false);

  // Name autocomplete (only in "Novo Embarcador"). Helps prevent re-cadastro de
  // um embarcador existente sugerindo correspondencias enquanto o usuario digita.
  const [nameQuery, setNameQuery] = useState('');
  const debouncedNameQuery = useDebounce(nameQuery, 300);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const nameSuggestionContainerRef = useRef<HTMLDivElement>(null);
  const { data: nameMatches } = useShippers(debouncedNameQuery, {
    enabled: !isEditing && open && debouncedNameQuery.trim().length >= 3,
  });
  const visibleNameMatches = (nameMatches ?? []).slice(0, 5);

  const form = useForm<ShipperFormData>({
    resolver: zodResolver(shipperSchema),
    defaultValues: {
      name: '',
      contact_name: '',
      cpf: '',
      cnpj: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      notes: '',
      state_registration: '',
      ie_indicator: 1,
      legal_representative_name: '',
      legal_representative_cpf: '',
      legal_representative_role: '',
    },
  });

  useEffect(() => {
    if (shipper) {
      form.reset({
        name: shipper.name,
        contact_name: shipper.contact_name || '',
        cpf: shipper.cpf || '',
        cnpj: shipper.cnpj || '',
        email: shipper.email || '',
        phone: shipper.phone || '',
        address: shipper.address || '',
        city: shipper.city || '',
        state: shipper.state || '',
        zip_code: shipper.zip_code || '',
        notes: shipper.notes || '',
        state_registration: shipper.state_registration || '',
        ie_indicator: shipper.ie_indicator ?? 1,
        legal_representative_name: shipper.legal_representative_name || '',
        legal_representative_cpf: shipper.legal_representative_cpf || '',
        legal_representative_role: shipper.legal_representative_role || '',
      });
    } else {
      form.reset({
        name: '',
        contact_name: '',
        cpf: '',
        cnpj: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        notes: '',
        state_registration: '',
        ie_indicator: 1,
        legal_representative_name: '',
        legal_representative_cpf: '',
        legal_representative_role: '',
      });
    }
  }, [shipper, form]);

  // CNPJ auto-lookup — usa helper compartilhado em @/lib/cnpjLookup.
  // Estado adicional armazena o resultado completo para persistir os 13 campos
  // novos (nome fantasia, natureza juridica, CNAE, situacao, QSA, etc.) no submit.
  const [cnpjResult, setCnpjResult] = useState<Awaited<ReturnType<typeof lookupCnpj>> | null>(null);

  const safeSet = (key: keyof ShipperFormData, value?: unknown) => {
    const str = value != null ? String(value).trim() : '';
    if (!str) return;
    const current = form.getValues(key);
    if (typeof current === 'string' && current.trim().length > 0) return; // nao sobrescreve se usuario ja preencheu
    form.setValue(key, str, { shouldValidate: true, shouldDirty: true });
  };

  /** Resolve a Inscrição Estadual via SintegrAPI (CNPJ + UF). Funciona em novo e edição. */
  const handleIeLookup = async (cnpjArg?: string, ufArg?: string) => {
    const cnpj = (cnpjArg ?? form.getValues('cnpj') ?? '').replace(/\D/g, '');
    const uf = (ufArg ?? form.getValues('state') ?? '').toUpperCase().slice(0, 2);
    if (cnpj.length !== 14 || uf.length !== 2) {
      toast.error('Preencha CNPJ e UF para buscar a Inscrição Estadual');
      return;
    }
    setIsLookingUpIe(true);
    try {
      const r = await lookupIe(cnpj, uf);
      if (!r) {
        toast.error('Preencha CNPJ e UF válidos para buscar a Inscrição Estadual');
        return;
      }
      if (r.ie) {
        form.setValue('state_registration', r.ie, { shouldDirty: true, shouldValidate: true });
        form.setValue('ie_indicator', 1, { shouldDirty: true });
        toast.success(`IE encontrada: ${r.ie}`);
      } else if (r.naoContribuinte) {
        form.setValue('ie_indicator', 9, { shouldDirty: true });
        form.setValue('state_registration', '', { shouldDirty: true });
        toast.success('Não contribuinte de ICMS — sem IE');
      }
    } catch (e) {
      const msg =
        e instanceof IeLookupError || e instanceof Error
          ? e.message
          : 'IE não encontrada (verifique CNPJ/UF ou a configuração da API)';
      toast.error(msg);
    } finally {
      setIsLookingUpIe(false);
    }
  };

  const handleCnpjLookup = async (rawValue?: string) => {
    const raw = rawValue ?? form.getValues('cnpj') ?? '';
    if (digits(raw).length !== 14) return;

    setIsLookingUp(true);
    try {
      const result = await lookupCnpj(raw);
      setCnpjResult(result);

      // Identificacao + contato
      safeSet('name', result.name ?? result.trade_name);
      safeSet('email', result.email);
      safeSet('phone', result.phone);

      // Endereco — agora com bairro/numero/complemento separados
      safeSet('address', result.address);
      safeSet('city', result.city);
      safeSet('state', result.state);
      safeSet('zip_code', result.zip_code);

      // Resolve IE automaticamente pela UF do CNPJ (SintegrAPI)
      await handleIeLookup(raw, result.state ?? undefined);

      // Auto-sugestao de representante legal a partir do QSA
      const rep = pickLegalRepresentative(result.partners);
      if (rep) {
        safeSet('legal_representative_name', rep.name);
        safeSet('legal_representative_role', rep.role);
        if (rep.document) safeSet('legal_representative_cpf', rep.document);
      }

      const partnerCount = result.partners.length;
      toast.success(
        partnerCount > 0
          ? `Dados preenchidos pelo CNPJ (${partnerCount} sócio${partnerCount !== 1 ? 's' : ''} no QSA)`
          : 'Dados preenchidos pelo CNPJ'
      );
    } catch (e) {
      if (e instanceof CnpjLookupError) {
        toast.error(e.message);
      } else {
        toast.error('Falha ao consultar CNPJ — verifique sua conexão');
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const onSubmit = async (data: ShipperFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado para criar embarcadores');
      return;
    }

    try {
      // Campos derivados do lookup CNPJ (so populados se houve consulta nesta sessao)
      const cnpjFields = cnpjResult
        ? {
            trade_name: cnpjResult.trade_name,
            legal_nature: cnpjResult.legal_nature,
            legal_nature_code: cnpjResult.legal_nature_code,
            company_size: cnpjResult.company_size,
            cnae_main_code: cnpjResult.cnae_main_code,
            cnae_main_description: cnpjResult.cnae_main_description,
            cnaes_secondary: cnpjResult.cnaes_secondary,
            opening_date: cnpjResult.opening_date,
            registration_status: cnpjResult.registration_status,
            registration_status_date: cnpjResult.registration_status_date,
            registration_status_reason: cnpjResult.registration_status_reason,
            efr: cnpjResult.efr,
            share_capital: cnpjResult.share_capital,
            partners: cnpjResult.partners,
            address_number: cnpjResult.address_number,
            address_complement: cnpjResult.address_complement,
            address_neighborhood: cnpjResult.address_neighborhood,
            cnpj_lookup_at: new Date().toISOString(),
          }
        : {};

      const baseFields = {
        name: data.name,
        contact_name: data.contact_name || null,
        cpf: data.cpf ? digits(data.cpf) : null,
        cnpj: data.cnpj ? digits(data.cnpj) : null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        notes: data.notes || null,
        state_registration: data.state_registration || null,
        ie_indicator: data.ie_indicator ?? null,
        legal_representative_name: data.legal_representative_name || null,
        legal_representative_cpf: data.legal_representative_cpf || null,
        legal_representative_role: data.legal_representative_role || null,
        ...cnpjFields,
      };

      if (isEditing && shipper) {
        await updateShipperMutation.mutateAsync({
          id: shipper.id,
          updates: baseFields,
        });
        toast.success('Embarcador atualizado com sucesso');
      } else {
        await createShipperMutation.mutateAsync({
          ...baseFields,
          created_by: user.id,
        });
        toast.success('Embarcador criado com sucesso');
      }
      onClose();
    } catch (error) {
      toast.error(isEditing ? 'Erro ao atualizar embarcador' : 'Erro ao criar embarcador');
    }
  };

  const isLoading = createShipperMutation.isPending || updateShipperMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Embarcador' : 'Novo Embarcador'}</DialogTitle>
          <DialogDescription className="sr-only">
            Informe os dados cadastrais e de contato do embarcador para salvar o registro.
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
                    <div ref={nameSuggestionContainerRef} className="relative">
                      <Input
                        placeholder="Empresa LTDA"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!isEditing) {
                            setNameQuery(e.target.value);
                            setShowNameSuggestions(true);
                          }
                        }}
                        onFocus={() => {
                          if (!isEditing && nameQuery.trim().length >= 3) {
                            setShowNameSuggestions(true);
                          }
                        }}
                        onBlur={(e) => {
                          field.onBlur();
                          // Delay so a click on a suggestion fires before we hide
                          window.setTimeout(() => setShowNameSuggestions(false), 150);
                        }}
                        autoComplete="off"
                      />
                      {!isEditing && showNameSuggestions && visibleNameMatches.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-popover shadow-md">
                          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
                            <AlertTriangle className="size-3.5 text-warning" />
                            <span>
                              Já existem embarcadores com nome parecido — clique para editar em vez
                              de criar duplicata
                            </span>
                          </div>
                          <ul className="max-h-60 overflow-y-auto py-1">
                            {visibleNameMatches.map((match) => (
                              <li key={match.id}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    // mousedown so it fires before the input's blur
                                    e.preventDefault();
                                    setShowNameSuggestions(false);
                                    onSelectExisting?.(match);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium text-foreground truncate">
                                      {match.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {[match.city, match.state].filter(Boolean).join(' - ') || '—'}
                                    </span>
                                  </div>
                                  {match.cnpj && (
                                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                      {match.cnpj}
                                    </div>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
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
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do responsável" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <MaskedInput
                        mask="cpf"
                        placeholder="000.000.000-00"
                        value={field.value || ''}
                        onValueChange={(raw) => field.onChange(raw ?? '')}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MaskedInput
                          mask="cnpj"
                          placeholder="00.000.000/0000-00"
                          value={field.value || ''}
                          onValueChange={(raw) => {
                            field.onChange(raw ?? '');
                            const d = (raw ?? '').replace(/\D/g, '');
                            if (d.length === 14) handleCnpjLookup(d);
                          }}
                          onBlur={field.onBlur}
                          className="pr-10"
                        />
                        {isLookingUp && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        {!isLookingUp && field.value && digits(field.value).length === 14 && (
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-primary transition-colors"
                            onClick={handleCnpjLookup}
                            title="Consultar CNPJ"
                          >
                            <Search className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </button>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      <Input type="email" placeholder="contato@empresa.com" {...field} />
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
                      <Input placeholder="São Paulo" {...field} />
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
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" maxLength={2} {...field} />
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

            <details className="group border rounded-md px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground group-open:text-foreground select-none">
                Dados para Contrato (opcional)
              </summary>
              <div className="mt-3 space-y-3">
                <FormField
                  control={form.control}
                  name="ie_indicator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indicador de Inscrição Estadual</FormLabel>
                      <Select
                        value={String(field.value ?? 1)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 — Contribuinte ICMS</SelectItem>
                          <SelectItem value="2">2 — Contribuinte Isento</SelectItem>
                          <SelectItem value="9">9 — Não Contribuinte</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state_registration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Estadual</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="Isento" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleIeLookup()}
                          disabled={isLookingUpIe}
                          title="Buscar Inscrição Estadual na SEFAZ (SintegrAPI) pelo CNPJ + UF"
                        >
                          {isLookingUpIe ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                          <span className="ml-1">Buscar IE</span>
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="legal_representative_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Representante Legal</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo para assinatura" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="legal_representative_cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF do Representante</FormLabel>
                        <FormControl>
                          <Input placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="legal_representative_role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo / Função</FormLabel>
                        <FormControl>
                          <Input placeholder="Sócio-Gerente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </details>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informações adicionais sobre o embarcador..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Embarcador'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
