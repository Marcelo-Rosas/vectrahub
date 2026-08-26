import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type VehicleRow = Database['public']['Tables']['vehicles']['Row'];
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert'];
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update'];

export type Vehicle = VehicleRow;

export interface VehicleWithRelations extends VehicleRow {
  owner?: { id: string; name: string; phone: string | null } | null;
  driver?: {
    id: string;
    name: string;
    phone: string | null;
    cnh?: string | null;
    cpf?: string | null;
    antt?: string | null;
    contract_type?: 'proprio' | 'agregado' | 'terceiro' | null;
    rntrc_registry_type?: 'TAC' | 'ETC' | null;
  } | null;
  vehicle_type?: { id: string; code: string; name: string } | null;
}

const selectWithRelations =
  'id, plate, plate_2, brand, model, year, color, renavam, vehicle_type_id, capacity_kg, capacity_m3, qtd_pallets, driver_id, owner_id, active, created_at, updated_at, ' +
  'owner:owners(id,name,phone), ' +
  'driver:drivers(id,name,phone,cnh,cpf,antt,contract_type,rntrc_registry_type), ' +
  'vehicle_type:vehicle_types(id,code,name)';

// selectBase usa apenas colunas originais — seguro mesmo antes do SQL de migration ser rodado no Supabase
const selectBase = 'id, plate, brand, model, driver_id, active';
const selectWithDriverOnly = `${selectBase}, driver:drivers(id,name,phone,cnh,cpf,antt,contract_type,rntrc_registry_type)`;

export function useVehicles(driverId?: string | null) {
  return useQuery({
    queryKey: ['vehicles', driverId],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select(selectWithRelations)
        .eq('active', asDb(true))
        .order('plate', { ascending: true });

      if (driverId) {
        query = query.eq('driver_id', asDb(driverId));
      }

      const { data, error } = await query;

      if (error) {
        // Fallback universal: qualquer erro na query principal tenta sem join de owner
        let fallbackQuery = supabase
          .from('vehicles')
          .select(selectWithDriverOnly)
          .eq('active', asDb(true))
          .order('plate', { ascending: true });
        if (driverId) {
          fallbackQuery = fallbackQuery.eq('driver_id', asDb(driverId));
        }
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) throw fallbackError;
        return (filterSupabaseRows<VehicleWithRelations>(fallbackData) || []).map((row) => ({
          ...row,
          owner: null,
          driver: row.driver
            ? {
                id: row.driver.id,
                name: row.driver.name,
                phone: row.driver.phone,
                cnh: row.driver.cnh ?? null,
                cpf: row.driver.cpf ?? null,
                antt: row.driver.antt ?? null,
                contract_type: row.driver.contract_type ?? null,
                rntrc_registry_type: row.driver.rntrc_registry_type ?? null,
              }
            : null,
        }));
      }
      return filterSupabaseRows<VehicleWithRelations>(data);
    },
  });
}

/** Normaliza placa para busca (maiúscula, sem espaços/hífen). */
function normalizePlate(plate: string) {
  return plate.replace(/\s|-/g, '').toUpperCase().trim();
}

/** Busca veículo por placa (motorista e proprietário vêm junto). Ativo apenas quando plate tem 7+ caracteres. */
export function useVehicleByPlate(plate: string | null | undefined) {
  const normalized = plate ? normalizePlate(plate) : '';
  const enabled = normalized.length >= 7;

  return useQuery({
    queryKey: ['vehicles', 'byPlate', normalized],
    queryFn: async () => {
      if (normalized.length < 7) return null;
      const query = supabase.from('vehicles').select(selectWithRelations).eq('active', asDb(true));

      const { data, error } = await query;

      const pick = (rows: VehicleWithRelations[] | null | undefined) =>
        (rows || []).find((row) => normalizePlate(row.plate) === normalized) ?? null;

      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('vehicles')
          .select(selectWithDriverOnly)
          .eq('active', asDb(true));
        if (fallbackError) throw fallbackError;
        const row = pick(filterSupabaseRows<VehicleWithRelations>(fallbackData));
        if (!row) return null;
        return { ...row, owner: null };
      }
      return pick(filterSupabaseRows<VehicleWithRelations>(data));
    },
    enabled,
  });
}

export function useVehicle(id: string | null | undefined) {
  return useQuery({
    queryKey: ['vehicles', 'single', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('vehicles')
        .select(selectWithRelations)
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) {
        // Fallback universal: qualquer erro tenta sem join de owner
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('vehicles')
          .select(selectWithDriverOnly)
          .eq('id', asDb(id))
          .maybeSingle();
        if (fallbackError) throw fallbackError;
        const row = filterSupabaseSingle<VehicleWithRelations>(fallbackData);
        if (!row) return null;
        return { ...row, owner: null };
      }
      return filterSupabaseSingle<VehicleWithRelations>(data);
    },
    enabled: !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vehicle: VehicleInsert) => {
      const { data, error } = await supabase
        .from('vehicles')
        .insert(asInsert(vehicle))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: VehicleUpdate }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Veículo não encontrado ou sem permissão para editar');
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicles').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}
