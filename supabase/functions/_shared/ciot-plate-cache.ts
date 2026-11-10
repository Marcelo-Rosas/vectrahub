/**
 * Vínculo placa↔transportador na ANTT (CIOT Online GET /antt/veiculo) com cache de 24h
 * em public.ciot_plate_checks — limite global de 20 validações/dia por placa.
 * Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md §4.1
 */
import { digits, formatPlateForCiot } from './ailog-ciot-client.ts';
import type { CiotOnlineClient } from './ciotonline-client.ts';

export const PLATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type PlateCheck = {
  vinculo_valido: boolean | null;
  mensagem: string | null;
  transportador: unknown;
  checked_at: string | null;
  from_cache: boolean;
  stale?: boolean;
  error?: string;
};

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

type CachedRow = {
  placa: string;
  rntrc: string;
  vinculo_valido: boolean;
  mensagem_antt?: string | null;
  transportador?: unknown;
  checked_at: string;
};

function fromRow(row: CachedRow, stale = false): PlateCheck {
  return {
    vinculo_valido: row.vinculo_valido,
    mensagem: row.mensagem_antt ?? null,
    transportador: row.transportador ?? null,
    checked_at: row.checked_at,
    from_cache: true,
    ...(stale ? { stale: true } : {}),
  };
}

export async function checkPlate(
  deps: {
    supabase: SupabaseLike;
    client: Pick<CiotOnlineClient, 'validarPlaca'>;
    now?: () => Date;
  },
  placaIn: string,
  rntrcIn: string,
  opts: { force?: boolean } = {}
): Promise<PlateCheck> {
  const now = (deps.now ?? (() => new Date()))();
  const placa = formatPlateForCiot(placaIn);
  const rntrc = digits(rntrcIn);

  const { data: cached } = await deps.supabase
    .from('ciot_plate_checks')
    .select('placa, rntrc, vinculo_valido, mensagem_antt, transportador, checked_at')
    .eq('placa', placa)
    .eq('rntrc', rntrc)
    .maybeSingle();
  const row = cached as CachedRow | null;
  const fresh = row && now.getTime() - new Date(row.checked_at).getTime() < PLATE_CACHE_TTL_MS;
  if (row && fresh && !opts.force) return fromRow(row);

  const r = await deps.client.validarPlaca({ placa, rntrc });
  if (!r.ok) {
    const code = r.error.code;
    if ((code === 'limite_diario' || code === 'rate_limit') && row) return fromRow(row, true);
    return {
      vinculo_valido: null,
      mensagem: r.error.message,
      transportador: null,
      checked_at: null,
      from_cache: false,
      error: code,
    };
  }

  const d = r.data;
  const checked_at = now.toISOString();
  await deps.supabase.from('ciot_plate_checks').upsert(
    {
      placa,
      rntrc,
      vinculo_valido: Boolean(d.vinculo_valido),
      mensagem_antt: d.mensagem ?? null,
      transportador: d.transportador ?? null,
      veiculo: d.veiculo ?? null,
      checked_at,
      raw: d,
    },
    { onConflict: 'placa,rntrc' }
  );
  return {
    vinculo_valido: Boolean(d.vinculo_valido),
    mensagem: d.mensagem ?? null,
    transportador: d.transportador ?? null,
    checked_at,
    from_cache: false,
  };
}
