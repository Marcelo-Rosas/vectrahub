import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Truck, User, Building2, Phone, FileText } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useCreateVehicle, useUpdateVehicle } from '@/hooks/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { useOwners } from '@/hooks/useOwners';
import { useVehicleTypesFleetForm } from '@/hooks/useVehicleTypes';
import { toast } from 'sonner';
import type { VehicleWithRelations } from '@/hooks/useVehicles';
import type { Database } from '@/integrations/supabase/types';
import {
  validatePlate,
  zodPlate,
  FOCUS_TIPO_RODADO,
  FOCUS_TIPO_CARROCERIA,
} from '@/lib/validators';
import { calculatePalletsFromVolume } from '@/lib/pallets';

type VehicleInsert = Database['public']['Tables']['vehicles']['Insert'];
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update'];

const vehicleSchema = z
  .object({
    plate: zodPlate,
    plate_2: z
      .string()
      .optional()
      .refine(
        (v) => !v || validatePlate(v),
        'Placa da carreta inválida – use o formato ABC1234 ou ABC1D23 (Mercosul)'
      ),
    brand: z.string().optional(),
    model: z.string().optional(),
    year: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{4}$/.test(v.trim()), 'Ano inválido – informe 4 dígitos (ex: 2020)'),
    color: z.string().optional(),
    renavam: z.string().optional(),
    vehicle_type_id: z.string().optional(),
    capacity_kg: z.string().optional(),
    capacity_m3: z.string().optional(),
    qtd_pallets: z.string().optional(),
    driver_id: z.string().optional(),
    owner_id: z.string().optional(),
    active: z.boolean(),
    // ── Focus/SEFAZ modal rodoviário (obrig. se veículo ativo) ──
    tara_kg: z.string().optional(),
    tipo_rodado: z.string().optional(),
    tipo_carroceria: z.string().optional(),
    uf_licenciamento: z
      .string()
      .max(2, 'Use a sigla da UF (ex: SC)')
      .optional()
      .transform((v) => v?.toUpperCase()),
    reboque_tara_kg: z.string().optional(),
    reboque_capacity_kg: z.string().optional(),
    reboque_tipo_carroceria: z.string().optional(),
    reboque_uf_licenciamento: z
      .string()
      .max(2, 'Use a sigla da UF (ex: SC)')
      .optional()
      .transform((v) => v?.toUpperCase()),
  })
  .superRefine((data, ctx) => {
    if (!data.active) return;
    const tara = data.tara_kg?.trim() ? parseFloat(data.tara_kg) : NaN;
    if (!Number.isFinite(tara) || tara <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tara_kg'],
        message: 'Tara (kg) obrigatória para veículo ativo (MDF-e / Focus)',
      });
    }
    if (!FOCUS_TIPO_RODADO.includes(data.tipo_rodado as (typeof FOCUS_TIPO_RODADO)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tipo_rodado'],
        message: 'Tipo de rodado obrigatório (01–06)',
      });
    }
    if (
      !FOCUS_TIPO_CARROCERIA.includes(
        data.tipo_carroceria as (typeof FOCUS_TIPO_CARROCERIA)[number]
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tipo_carroceria'],
        message: 'Tipo de carroceria obrigatório (00–05)',
      });
    }
    if (!data.uf_licenciamento || data.uf_licenciamento.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['uf_licenciamento'],
        message: 'UF de licenciamento obrigatória (2 letras)',
      });
    }
    // Reboque: se tem plate_2, exige tara + carroceria reboque
    if (data.plate_2?.trim()) {
      const rTara = data.reboque_tara_kg?.trim() ? parseFloat(data.reboque_tara_kg) : NaN;
      if (!Number.isFinite(rTara) || rTara <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reboque_tara_kg'],
          message: 'Tara do reboque obrigatória quando há placa da carreta',
        });
      }
      if (
        data.reboque_tipo_carroceria &&
        !FOCUS_TIPO_CARROCERIA.includes(
          data.reboque_tipo_carroceria as (typeof FOCUS_TIPO_CARROCERIA)[number]
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reboque_tipo_carroceria'],
          message: 'Tipo carroceria reboque inválido (00–05)',
        });
      }
    }
  });

type VehicleFormData = z.infer<typeof vehicleSchema>;

// Tabelas SEFAZ / Focus (MDF-e modal rodoviário)
const TIPO_RODADO_OPTIONS = [
  { value: '01', label: '01 — Truck' },
  { value: '02', label: '02 — Toco' },
  { value: '03', label: '03 — Cavalo Mecânico' },
  { value: '04', label: '04 — VAN' },
  { value: '05', label: '05 — Utilitário' },
  { value: '06', label: '06 — Outros' },
] as const;

const TIPO_CARROCERIA_OPTIONS = [
  { value: '00', label: '00 — Não aplicável' },
  { value: '01', label: '01 — Aberta' },
  { value: '02', label: '02 — Fechada / Baú' },
  { value: '03', label: '03 — Granelera' },
  { value: '04', label: '04 — Porta Container' },
  { value: '05', label: '05 — Sider' },
] as const;

/** Campos MDF-e ainda não presentes nos tipos gerados — acesso via cast. */
type VehicleMdfeColumns = {
  tara_kg?: number | null;
  tipo_rodado?: string | null;
  tipo_carroceria?: string | null;
  uf_licenciamento?: string | null;
  reboque_tara_kg?: number | null;
  reboque_capacity_kg?: number | null;
  reboque_tipo_carroceria?: string | null;
  reboque_uf_licenciamento?: string | null;
};

const numToStr = (v: number | null | undefined) => (v != null ? String(v) : '');
const strToNum = (v: string | undefined) => (v && v.trim() ? parseFloat(v) : null);

/** Lê as colunas MDF-e de um veículo (cast) para popular o form na edição. */
function mdfeFieldsFromVehicle(vehicle: VehicleWithRelations) {
  const v = vehicle as unknown as VehicleMdfeColumns;
  return {
    tara_kg: numToStr(v.tara_kg),
    tipo_rodado: v.tipo_rodado || '',
    tipo_carroceria: v.tipo_carroceria || '',
    uf_licenciamento: v.uf_licenciamento || '',
    reboque_tara_kg: numToStr(v.reboque_tara_kg),
    reboque_capacity_kg: numToStr(v.reboque_capacity_kg),
    reboque_tipo_carroceria: v.reboque_tipo_carroceria || '',
    reboque_uf_licenciamento: v.reboque_uf_licenciamento || '',
  };
}

/** Converte os campos MDF-e do form para o payload do banco (numéricos + null). */
function mdfePayloadFromForm(data: VehicleFormData): VehicleMdfeColumns {
  const hasReboque = !!data.plate_2?.trim();
  return {
    tara_kg: strToNum(data.tara_kg),
    tipo_rodado: data.tipo_rodado || null,
    tipo_carroceria: data.tipo_carroceria || null,
    uf_licenciamento: data.uf_licenciamento || null,
    // Reboque só faz sentido com placa de carreta; sem ela, zera.
    reboque_tara_kg: hasReboque ? strToNum(data.reboque_tara_kg) : null,
    reboque_capacity_kg: hasReboque ? strToNum(data.reboque_capacity_kg) : null,
    reboque_tipo_carroceria: hasReboque ? data.reboque_tipo_carroceria || null : null,
    reboque_uf_licenciamento: hasReboque ? data.reboque_uf_licenciamento || null : null,
  };
}

interface VehicleFormProps {
  open: boolean;
  onClose: () => void;
  vehicle?: VehicleWithRelations | null;
}

export function VehicleForm({ open, onClose, vehicle }: VehicleFormProps) {
  const createVehicleMutation = useCreateVehicle();
  const updateVehicleMutation = useUpdateVehicle();
  const { data: drivers, isLoading: driversLoading } = useDrivers(true, { enabled: open });
  const { data: owners, isLoading: ownersLoading } = useOwners(undefined, { enabled: open });
  const { data: vehicleTypes, isLoading: vehicleTypesLoading } = useVehicleTypesFleetForm();
  const isEditing = !!vehicle;

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate: '',
      plate_2: '',
      brand: '',
      model: '',
      year: '',
      color: '',
      renavam: '',
      vehicle_type_id: '',
      capacity_kg: '',
      capacity_m3: '',
      qtd_pallets: '',
      driver_id: '',
      owner_id: '',
      active: true,
      tara_kg: '',
      tipo_rodado: '',
      tipo_carroceria: '',
      uf_licenciamento: '',
      reboque_tara_kg: '',
      reboque_capacity_kg: '',
      reboque_tipo_carroceria: '',
      reboque_uf_licenciamento: '',
    },
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        plate: vehicle.plate,
        plate_2: vehicle.plate_2 || '',
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year ? String(vehicle.year) : '',
        color: vehicle.color || '',
        renavam: vehicle.renavam || '',
        vehicle_type_id: vehicle.vehicle_type_id || '',
        capacity_kg:
          ((vehicle as unknown as { capacity_kg?: number | null }).capacity_kg ?? '').toString() ||
          '',
        capacity_m3:
          ((vehicle as unknown as { capacity_m3?: number | null }).capacity_m3 ?? '').toString() ||
          '',
        qtd_pallets:
          ((vehicle as unknown as { qtd_pallets?: number | null }).qtd_pallets ?? '').toString() ||
          '',
        driver_id: vehicle.driver_id || '',
        owner_id: vehicle.owner_id || '',
        active: vehicle.active,
        ...mdfeFieldsFromVehicle(vehicle),
      });
    } else {
      form.reset({
        plate: '',
        plate_2: '',
        brand: '',
        model: '',
        year: '',
        color: '',
        renavam: '',
        vehicle_type_id: '',
        capacity_kg: '',
        capacity_m3: '',
        qtd_pallets: '',
        driver_id: '',
        owner_id: '',
        active: true,
        tara_kg: '',
        tipo_rodado: '',
        tipo_carroceria: '',
        uf_licenciamento: '',
        reboque_tara_kg: '',
        reboque_capacity_kg: '',
        reboque_tipo_carroceria: '',
        reboque_uf_licenciamento: '',
      });
    }
  }, [vehicle, form]);

  const onSubmit = async (data: VehicleFormData) => {
    try {
      const plate = data.plate.trim().toUpperCase().replace(/[-\s]/g, '');
      const plate2 = data.plate_2?.trim().toUpperCase().replace(/[-\s]/g, '') || null;
      if (isEditing && vehicle) {
        await updateVehicleMutation.mutateAsync({
          id: vehicle.id,
          updates: {
            plate,
            plate_2: plate2,
            brand: data.brand || null,
            model: data.model || null,
            year: data.year ? parseInt(data.year, 10) : null,
            color: data.color || null,
            renavam: data.renavam || null,
            vehicle_type_id: data.vehicle_type_id || null,
            capacity_kg: data.capacity_kg ? parseFloat(data.capacity_kg) : null,
            capacity_m3: data.capacity_m3 ? parseFloat(data.capacity_m3) : null,
            qtd_pallets: data.qtd_pallets ? parseInt(data.qtd_pallets, 10) : null,
            driver_id: data.driver_id || null,
            owner_id: data.owner_id || null,
            active: data.active,
            ...mdfePayloadFromForm(data),
          } as unknown as VehicleUpdate,
        });
        toast.success('Veículo atualizado com sucesso');
      } else {
        await createVehicleMutation.mutateAsync({
          plate,
          plate_2: plate2,
          brand: data.brand || null,
          model: data.model || null,
          year: data.year ? parseInt(data.year, 10) : null,
          color: data.color || null,
          renavam: data.renavam || null,
          vehicle_type_id: data.vehicle_type_id || null,
          driver_id: data.driver_id || null,
          owner_id: data.owner_id || null,
          active: data.active,
          ...mdfePayloadFromForm(data),
        } as unknown as VehicleInsert);
        toast.success('Veículo criado com sucesso');
      }
      onClose();
    } catch (error) {
      // PostgrestError 23505 = unique_violation (placa/renavam duplicado)
      const e = error as { code?: string; status?: number; message?: string } | undefined;
      if (e?.code === '23505' || e?.status === 409 || /duplicate|unique/i.test(e?.message ?? '')) {
        const isPlate = /plate|placa/i.test(e?.message ?? '');
        const isRenavam = /renavam/i.test(e?.message ?? '');
        if (isRenavam) {
          toast.error('Já existe um veículo com este RENAVAM. Edite o cadastro existente.');
        } else if (isPlate) {
          toast.error('Já existe um veículo com esta placa. Edite o cadastro existente.');
        } else {
          toast.error('Veículo já cadastrado (placa ou RENAVAM em duplicidade).');
        }
        return;
      }
      toast.error(
        isEditing
          ? `Erro ao atualizar veículo: ${e?.message ?? 'desconhecido'}`
          : `Erro ao criar veículo: ${e?.message ?? 'desconhecido'}`
      );
    }
  };

  const isLoading = createVehicleMutation.isPending || updateVehicleMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[96vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {isEditing ? 'Editar Veículo' : 'Novo Veículo'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preencha placa, características e vínculos do veículo com motorista e proprietário.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* ── Identificação do Veículo ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Identificação
              </p>

              {/* Placa + Placa Carreta */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC1D23"
                          {...field}
                          className="font-mono uppercase tracking-widest"
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, '')
                                .slice(0, 7)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plate_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa Carreta</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC1D23"
                          {...field}
                          className="font-mono uppercase tracking-widest"
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, '')
                                .slice(0, 7)
                            )
                          }
                        />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground">
                        Reboque/semirreboque — sai como "Carreta" na Ordem de Coleta.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Ano */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: 2022"
                          maxLength={4}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Marca + Modelo */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Mercedes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Actros 2651" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Cor + RENAVAM */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Branco" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="renavam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RENAVAM</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-1">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Veículo ativo</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ── Tipo de Veículo ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                Tipo de Veículo
              </p>
              <FormField
                control={form.control}
                name="vehicle_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                      value={field.value || '__none__'}
                      disabled={vehicleTypesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              vehicleTypesLoading ? 'Carregando...' : 'Selecionar tipo...'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {vehicleTypes?.map((vt) => (
                          <SelectItem key={vt.id} value={vt.id}>
                            {vt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Capacidade real do veiculo individual */}
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="capacity_kg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidade (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="100" placeholder="14000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity_m3"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume (m³)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.5" placeholder="45" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="qtd_pallets"
                  render={({ field }) => {
                    const m3Raw = form.watch('capacity_m3');
                    const m3Num = m3Raw ? parseFloat(m3Raw) : null;
                    const calc = calculatePalletsFromVolume(m3Num);
                    return (
                      <FormItem>
                        <FormLabel>Pallets PBR</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder={calc != null ? `auto: ${calc}` : '—'}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground">
                          {calc != null && !field.value
                            ? `Cálculo automático: ${calc} pallets (1m × 1,20m). Preencha para sobrescrever.`
                            : 'Vazio = usa cálculo automático a partir do m³.'}
                        </p>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            </div>

            <Separator />

            {/* ── Motorista ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Motorista
              </p>
              <FormField
                control={form.control}
                name="driver_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motorista vinculado</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                      value={field.value || '__none__'}
                      disabled={driversLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              driversLoading ? 'Carregando...' : 'Selecionar motorista...'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            <div className="flex flex-col gap-0.5">
                              <span>{driver.name}</span>
                              {driver.phone && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {driver.phone}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ── Proprietário ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Proprietário
              </p>
              <FormField
                control={form.control}
                name="owner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proprietário vinculado</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                      value={field.value || '__none__'}
                      disabled={ownersLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              ownersLoading ? 'Carregando...' : 'Selecionar proprietário...'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {owners?.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span>{owner.name}</span>
                                {!owner.active && (
                                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                                    Inativo
                                  </Badge>
                                )}
                              </div>
                              {owner.cpf_cnpj && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {owner.cpf_cnpj}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ── Dados Fiscais (MDF-e) ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Dados Fiscais (MDF-e)
              </p>
              <p className="text-[10px] text-muted-foreground -mt-1">
                Obrigatórios (Focus/SEFAZ) para veículo ativo emitir MDF-e.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="tipo_rodado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de rodado *</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                        value={field.value || '__none__'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Nenhum</span>
                          </SelectItem>
                          {TIPO_RODADO_OPTIONS.map((o) => (
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
                <FormField
                  control={form.control}
                  name="tipo_carroceria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de carroceria *</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                        value={field.value || '__none__'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Nenhum</span>
                          </SelectItem>
                          {TIPO_CARROCERIA_OPTIONS.map((o) => (
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="tara_kg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tara (kg) *</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="100" placeholder="8500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uf_licenciamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF de licenciamento *</FormLabel>
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
              </div>

              {/* Reboque/semirreboque — só quando há placa de carreta */}
              {!!form.watch('plate_2')?.trim() && (
                <div className="space-y-3 rounded-md border border-dashed p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Reboque / semirreboque ({form.watch('plate_2')})
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="reboque_tara_kg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tara reboque (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="100" placeholder="6000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reboque_capacity_kg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacidade reboque (kg)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="100"
                              placeholder="25000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="reboque_tipo_carroceria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Carroceria reboque</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                            value={field.value || '__none__'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="text-muted-foreground">Nenhum</span>
                              </SelectItem>
                              {TIPO_CARROCERIA_OPTIONS.map((o) => (
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
                    <FormField
                      control={form.control}
                      name="reboque_uf_licenciamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF licenc. reboque</FormLabel>
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
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Criar Veículo'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
