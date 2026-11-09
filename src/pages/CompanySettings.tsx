import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building2, Save, Search, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  useCompanySettings,
  useCreateCompanySettings,
  useUpdateCompanySettings,
} from '@/hooks/useCompanySettings';
import { MainLayout } from '@/components/layout/MainLayout';
import { MaskedInput } from '@/components/ui/masked-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { validateCnpj, zodPartialCpf } from '@/lib/validators';
import { formatRepresentativeCpfForForm } from '@/lib/company-settings-normalize';
import { fixMojibake } from '@/lib/fix-mojibake';
import {
  CnpjLookupError,
  lookupCnpj,
  pickLegalRepresentative,
  suggestTaxRegistrations,
} from '@/lib/cnpjLookup';
import {
  FICHA_CADASTRAL_FILE_NAME,
  generateCompanyFichaCadastralPdf,
} from '@/lib/generateCompanyFichaCadastralPdf';

const digits = (v: string) => v.replace(/\D/g, '');

const schema = z.object({
  legal_name: z.string().min(2, 'Razão social obrigatória'),
  trade_name: z.string().optional().default(''),
  cnpj: z
    .string()
    .min(1, 'CNPJ obrigatório')
    .refine((v) => digits(v).length === 14 && validateCnpj(v), 'CNPJ inválido'),
  state_registration: z.string().optional().default(''),
  municipal_registration: z.string().optional().default(''),
  address_street: z.string().min(2, 'Logradouro obrigatório'),
  address_number: z.string().min(1, 'Número obrigatório'),
  address_complement: z.string().optional().default(''),
  address_neighborhood: z.string().optional().default(''),
  address_city: z.string().min(2, 'Cidade obrigatória'),
  address_state: z
    .string()
    .length(2, 'Use a sigla do estado (ex: SC)')
    .transform((v) => v.toUpperCase()),
  address_zip: z.string().refine((v) => digits(v).length === 8, 'CEP inválido'),
  legal_representative_name: z.string().optional().default(''),
  legal_representative_cpf: zodPartialCpf,
  legal_representative_role: z.string().optional().default(''),
  bank_name: z.string().optional().default(''),
  bank_agency: z.string().optional().default(''),
  bank_account: z.string().optional().default(''),
  bank_pix_key: z.string().optional().default(''),
  default_jurisdiction: z.string().optional().default('Navegantes/SC'),
  signature_city: z.string().optional().default('Navegantes'),
  phone: z.string().optional().default(''),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function CompanySettings() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateMutation = useUpdateCompanySettings();
  const createMutation = useCreateCompanySettings();
  const isFirstSetup = !settings?.id;
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isDownloadingFicha, setIsDownloadingFicha] = useState(false);
  const cnpjTouchedForLookup = useRef(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      legal_name: '',
      trade_name: '',
      cnpj: '',
      state_registration: '',
      municipal_registration: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
      address_zip: '',
      legal_representative_name: '',
      legal_representative_cpf: '',
      legal_representative_role: '',
      bank_name: '',
      bank_agency: '',
      bank_account: '',
      bank_pix_key: '',
      default_jurisdiction: 'Navegantes/SC',
      signature_city: 'Navegantes',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    if (settings) {
      cnpjTouchedForLookup.current = false;
      form.reset({
        legal_name: fixMojibake(settings.legal_name),
        trade_name: fixMojibake(settings.trade_name),
        cnpj: settings.cnpj ? digits(settings.cnpj) : '',
        state_registration: fixMojibake(settings.state_registration),
        municipal_registration: fixMojibake(settings.municipal_registration ?? ''),
        address_street: fixMojibake(settings.address_street),
        address_number: fixMojibake(settings.address_number),
        address_complement: fixMojibake(settings.address_complement ?? ''),
        address_neighborhood: fixMojibake(settings.address_neighborhood),
        address_city: fixMojibake(settings.address_city),
        address_state: settings.address_state ?? '',
        address_zip: settings.address_zip ? digits(settings.address_zip) : '',
        legal_representative_name: fixMojibake(settings.legal_representative_name ?? ''),
        legal_representative_cpf: formatRepresentativeCpfForForm(settings.legal_representative_cpf),
        legal_representative_role: fixMojibake(settings.legal_representative_role ?? ''),
        bank_name: fixMojibake(settings.bank_name ?? ''),
        bank_agency: settings.bank_agency ?? '',
        bank_account: settings.bank_account ?? '',
        bank_pix_key: settings.bank_pix_key ?? '',
        default_jurisdiction: settings.default_jurisdiction ?? 'Navegantes/SC',
        signature_city: settings.signature_city ?? 'Navegantes',
        phone: (settings as { phone?: string | null }).phone ?? '',
        email: (settings as { email?: string | null }).email ?? '',
      });
    }
  }, [settings, form]);

  const safeSet = (key: keyof FormData, value?: unknown) => {
    const str = value != null ? String(value).trim() : '';
    if (!str) return;
    const current = form.getValues(key);
    if (current && String(current).trim().length > 0) return;
    form.setValue(key, str, { shouldValidate: true, shouldDirty: true });
  };

  const handleCnpjLookup = async (rawValue?: string) => {
    const raw = rawValue ?? form.getValues('cnpj') ?? '';
    if (digits(raw).length !== 14) return;

    setIsLookingUp(true);
    try {
      const result = await lookupCnpj(raw);
      safeSet('legal_name', result.name ?? result.trade_name);
      safeSet('trade_name', result.trade_name);
      safeSet('address_street', result.address);
      safeSet('address_number', result.address_number);
      safeSet('address_complement', result.address_complement);
      safeSet('address_neighborhood', result.address_neighborhood);
      safeSet('address_city', result.city);
      safeSet('address_state', result.state);
      safeSet('address_zip', result.zip_code);
      safeSet('phone', result.phone);
      safeSet('email', result.email);

      const rep = pickLegalRepresentative(result.partners);
      if (rep) {
        safeSet('legal_representative_name', rep.name);
        safeSet('legal_representative_role', rep.role);
        if (rep.document) safeSet('legal_representative_cpf', digits(rep.document));
      }

      const tax = suggestTaxRegistrations(result);
      if (tax.state_registration) safeSet('state_registration', tax.state_registration);
      if (tax.municipal_registration) safeSet('municipal_registration', tax.municipal_registration);

      toast.success('Dados preenchidos pela consulta CNPJ', {
        description: tax.note,
        duration: 8000,
      });
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

  const onSubmit = (data: FormData) => {
    if (settings?.id) {
      updateMutation.mutate(
        { id: settings.id, ...data },
        {
          onSuccess: () => {
            toast.success('Configurações salvas');
            cnpjTouchedForLookup.current = false;
          },
        }
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Cadastro da empresa criado');
        cnpjTouchedForLookup.current = false;
      },
    });
  };

  const isSaving = updateMutation.isPending || createMutation.isPending;
  const canSave = !isSaving && !isLookingUp;

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const handleDownloadFichaCadastral = async () => {
    const data = form.getValues();
    if (!data.legal_name?.trim() || digits(data.cnpj).length !== 14) {
      toast.error('Preencha razão social e CNPJ antes de baixar a ficha cadastral');
      return;
    }

    setIsDownloadingFicha(true);
    try {
      const { blob, fileName } = await generateCompanyFichaCadastralPdf({
        legal_name: data.legal_name,
        trade_name: data.trade_name,
        cnpj: data.cnpj,
        state_registration: data.state_registration,
        municipal_registration: data.municipal_registration,
        address_street: data.address_street,
        address_number: data.address_number,
        address_complement: data.address_complement,
        address_neighborhood: data.address_neighborhood,
        address_city: data.address_city,
        address_state: data.address_state,
        address_zip: data.address_zip,
        legal_representative_name: data.legal_representative_name,
        legal_representative_cpf: data.legal_representative_cpf,
        legal_representative_role: data.legal_representative_role,
        bank_name: data.bank_name,
        bank_agency: data.bank_agency,
        bank_account: data.bank_account,
        bank_pix_key: data.bank_pix_key,
        default_jurisdiction: data.default_jurisdiction,
        signature_city: data.signature_city,
        phone: data.phone,
        email: data.email,
      });
      triggerBlobDownload(blob, fileName);
      toast.success('Ficha Cadastral Vectra HUB baixada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar a ficha cadastral');
    } finally {
      setIsDownloadingFicha(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dados da Empresa</h1>
            <p className="text-sm text-muted-foreground">
              Informações usadas na geração automática de contratos e VPO (WebRouter)
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    Ficha Cadastral Vectra HUB
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    PDF
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{FICHA_CADASTRAL_FILE_NAME}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void handleDownloadFichaCadastral()}
                disabled={isDownloadingFicha}
                title="Baixar Ficha Cadastral Vectra HUB"
                aria-label="Baixar Ficha Cadastral Vectra HUB"
                data-testid="btn-ficha-cadastral-download"
              >
                {isDownloadingFicha ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isFirstSetup && (
          <Alert>
            <AlertTitle>Primeiro cadastro</AlertTitle>
            <AlertDescription>
              Não há registro em company_settings. Preencha CNPJ e razão social e salve — requer
              usuário com role admin ou super_admin em user_roles.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="legal_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social *</FormLabel>
                        <FormControl>
                          <Input placeholder="Empresa LTDA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="trade_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Vectra Cargo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MaskedInput
                              mask="cnpj"
                              placeholder="00.000.000/0000-00"
                              value={field.value || ''}
                              onValueChange={(raw) => {
                                cnpjTouchedForLookup.current = true;
                                field.onChange(raw ?? '');
                              }}
                              onBlur={async () => {
                                field.onBlur();
                                if (
                                  cnpjTouchedForLookup.current &&
                                  digits(field.value ?? '').length === 14
                                ) {
                                  await handleCnpjLookup();
                                }
                              }}
                              className="pr-10"
                              aria-label="CNPJ da empresa"
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
                                onClick={() => {
                                  cnpjTouchedForLookup.current = true;
                                  void handleCnpjLookup();
                                }}
                                title="Consultar CNPJ na Receita Federal"
                                aria-label="Consultar CNPJ"
                              >
                                <Search className="w-4 h-4 text-muted-foreground hover:text-primary" />
                              </button>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          Saia do campo ou use a lupa para buscar razão social, endereço e QSA.
                        </FormDescription>
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
                        <FormControl>
                          <Input placeholder="Isento ou número da IE" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Não vem na consulta CNPJ; para MEI sugerimos &quot;ISENTO&quot;.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="municipal_registration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Municipal</FormLabel>
                        <FormControl>
                          <Input placeholder="Número na prefeitura" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Preencha manualmente conforme o município.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(47) 9XXXX-XXXX" {...field} />
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
                          <Input placeholder="fiscal@empresa.com.br" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado como contato do emitente nos documentos (CT-e e espelho). Não fica mais
                  hardcoded.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="address_street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro *</FormLabel>
                          <FormControl>
                            <Input placeholder="Avenida Principal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="address_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número *</FormLabel>
                        <FormControl>
                          <Input placeholder="495" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="address_complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Sala 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address_neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="São Pedro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name="address_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade *</FormLabel>
                          <FormControl>
                            <Input placeholder="Navegantes" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="address_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="SC"
                            maxLength={2}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address_zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP *</FormLabel>
                        <FormControl>
                          <MaskedInput
                            mask="cep"
                            placeholder="88370-053"
                            value={field.value || ''}
                            onValueChange={(raw) => field.onChange(raw ?? '')}
                            onBlur={field.onBlur}
                            aria-label="CEP"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Representante Legal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="legal_representative_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="legal_representative_cpf"
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
                            aria-label="CPF do representante legal"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Bancários</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banco</FormLabel>
                          <FormControl>
                            <Input placeholder="336 – Banco C6 S.A." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="bank_agency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agência</FormLabel>
                        <FormControl>
                          <Input placeholder="0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bank_account"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta Corrente</FormLabel>
                        <FormControl>
                          <Input placeholder="00000000-0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bank_pix_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave PIX</FormLabel>
                        <FormControl>
                          <Input placeholder="CNPJ ou e-mail" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contrato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="default_jurisdiction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Foro</FormLabel>
                        <FormControl>
                          <Input placeholder="Navegantes/SC" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="signature_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade de assinatura</FormLabel>
                        <FormControl>
                          <Input placeholder="Navegantes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex justify-end">
              <Button type="submit" disabled={!canSave}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isFirstSetup ? 'Criar cadastro da empresa' : 'Salvar Configurações'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </MainLayout>
  );
}
