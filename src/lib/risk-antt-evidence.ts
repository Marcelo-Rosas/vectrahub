import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionOrderAnttData } from '@/types/collectionOrder';
import type { RiskEvidence } from '@/types/risk';

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export function normalizePlate(s: string): string {
  return s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

export type AnttConsultPath = 'proprio' | 'agregado' | 'terceiro';

/**
 * Cadastro Vectra (contract_type) ≠ trilha ANTT.
 * Motorista dono do cavalo (mesmo CPF) consulta Por Transportador mesmo se
 * contract_type = terceiro (asset-light: terceiro pra Vectra, TAC pra ANTT).
 */
export function resolveAnttConsultPath(opts: {
  contractType?: AnttConsultPath | null;
  driverCpf?: string | null;
  ownerDoc?: string | null;
}): AnttConsultPath {
  const driver = onlyDigits(opts.driverCpf ?? '');
  const owner = onlyDigits(opts.ownerDoc ?? '');
  if (driver.length === 11 && owner.length === 11 && driver === owner) return 'proprio';
  if (owner.length === 14) return 'terceiro';
  if (driver.length === 11 && owner.length === 11 && driver !== owner) return 'agregado';
  if (
    opts.contractType === 'proprio' ||
    opts.contractType === 'agregado' ||
    opts.contractType === 'terceiro'
  ) {
    return opts.contractType;
  }
  return 'terceiro';
}

/** Filtro RNTRC no portal: só 9 dígitos. 8 (SEFAZ) envenena Por Transportador se mandar junto do CPF. */
export function anttRntrcForPortal(raw: string | null | undefined): string | undefined {
  const d = onlyDigits(raw ?? '');
  return d.length === 9 ? d : undefined;
}

/** Por Transportador sem grade (irregular/indeterminado + sem RNTRC) → tenta Por Veículo. */
export function anttShouldFallbackToPlaca(resp: {
  situacao?: string | null;
  rntrc?: string | null;
}): boolean {
  const s = String(resp.situacao || '').toLowerCase();
  if (s !== 'irregular' && s !== 'indeterminado') return false;
  return !String(resp.rntrc || '').trim();
}

export function isAnttPendente(payload: Record<string, unknown> | null | undefined): boolean {
  const raw = String(payload?.situacao_raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return raw === 'PENDENTE';
}

function matchesAnttEvidence(
  evidence: RiskEvidence,
  driverCpf: string | null | undefined,
  vehiclePlate: string | null | undefined,
  requireValid: boolean
): boolean {
  if (evidence.evidence_type !== 'antt_rntrc_check') return false;
  if (requireValid && evidence.status !== 'valid') return false;

  const p = evidence.payload as Record<string, unknown> | null;
  if (!p) return false;

  if (p.cpf_cnpj) {
    if (!driverCpf || onlyDigits(String(p.cpf_cnpj)) !== onlyDigits(driverCpf)) return false;
  }
  if (p.vehicle_plate) {
    if (!vehiclePlate || normalizePlate(String(p.vehicle_plate)) !== normalizePlate(vehiclePlate)) {
      return false;
    }
  }
  return true;
}

function pickAnttEvidence(
  rows: RiskEvidence[],
  driverCpf: string | null | undefined,
  vehiclePlate: string | null | undefined,
  requireValid: boolean
): RiskEvidence | null {
  return rows.find((e) => matchesAnttEvidence(e, driverCpf, vehiclePlate, requireValid)) ?? null;
}

/** Mesma regra do RiskWorkflowWizard: evidência local válida → cross válida → local mais recente. */
export async function resolveAnttEvidenceForOrder(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    driverCpf?: string | null;
    vehiclePlate?: string | null;
  }
): Promise<RiskEvidence | null> {
  const { orderId, driverCpf, vehiclePlate } = params;

  const { data: evals } = await supabase
    .from('risk_evaluations')
    .select('id')
    .eq('entity_type', 'order')
    .eq('entity_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1);

  const evalId = evals?.[0]?.id;
  let localRows: RiskEvidence[] = [];

  if (evalId) {
    const { data } = await supabase
      .from('risk_evidence' as 'documents')
      .select('*')
      .eq('evaluation_id', evalId)
      .eq('evidence_type', 'antt_rntrc_check')
      .order('created_at', { ascending: false });
    localRows = (data ?? []) as RiskEvidence[];
  }

  const localValid = pickAnttEvidence(localRows, driverCpf, vehiclePlate, true);
  if (localValid) return localValid;

  if (driverCpf && vehiclePlate) {
    const { data: crossRows } = await supabase
      .from('risk_evidence' as 'documents')
      .select('*')
      .eq('evidence_type', 'antt_rntrc_check')
      .eq('status', 'valid')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const cpfNorm = onlyDigits(driverCpf);
    const plateNorm = normalizePlate(vehiclePlate);
    const crossMatch =
      (crossRows ?? []).find((row) => {
        const p = (row as RiskEvidence).payload as Record<string, unknown> | null;
        return (
          p != null &&
          onlyDigits(String(p.cpf_cnpj ?? '')) === cpfNorm &&
          normalizePlate(String(p.vehicle_plate ?? '')) === plateNorm
        );
      }) ?? null;

    if (crossMatch) return crossMatch as RiskEvidence;
  }

  return pickAnttEvidence(localRows, driverCpf, vehiclePlate, false);
}

/** Extrai TAC|ETC do prefixo "ETC - Razão Social" (coluna Transportador ANTT). */
export function parseAnttRegistryTypeFromTransportador(
  transportador: string | null | undefined
): 'TAC' | 'ETC' | null {
  const raw = String(transportador ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/^\s*(TAC|ETC)\s*[-–—]/i) || raw.match(/^\s*(TAC|ETC)\s*$/i);
  return m ? (m[1].toUpperCase() as 'TAC' | 'ETC') : null;
}

/** Nome limpo sem prefixo TAC/ETC. */
export function stripAnttTransportadorPrefix(
  transportador: string | null | undefined
): string | null {
  const raw = String(transportador ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/^\s*(?:TAC|ETC)\s*[-–—]\s*(.+)$/i);
  return (m ? m[1].trim() : raw) || null;
}

/** Preferência: campo tipado → prefixo do transportador. */
export function resolveAnttRegistryType(input: {
  rntrc_registry_type?: 'TAC' | 'ETC' | null;
  transportador?: string | null;
}): 'TAC' | 'ETC' | null {
  const typed = input.rntrc_registry_type;
  if (typed === 'TAC' || typed === 'ETC') return typed;
  return parseAnttRegistryTypeFromTransportador(input.transportador);
}

/** "Itajaí/SC" → { municipio, uf }. */
export function parseAnttMunicipioUf(municipioUf: string | null | undefined): {
  municipio: string | null;
  uf: string | null;
} {
  const raw = String(municipioUf ?? '').trim();
  if (!raw) return { municipio: null, uf: null };
  const m = raw.match(/^(.+?)\s*\/\s*([A-Za-z]{2})\s*$/);
  if (m) {
    return { municipio: m[1].trim() || null, uf: m[2].toUpperCase() };
  }
  if (/^[A-Za-z]{2}$/.test(raw)) return { municipio: null, uf: raw.toUpperCase() };
  return { municipio: raw, uf: null };
}

/**
 * ANTT TAC/ETC → tipo_proprietario MDF-e (Focus).
 * TAC → 1 (Independente); ETC → 2 (Outros). Agregado (0) fica manual.
 */
export function anttRegistryToMdfeTipoProprietario(
  registry: 'TAC' | 'ETC' | null
): '0' | '1' | '2' | '' {
  if (registry === 'TAC') return '1';
  if (registry === 'ETC') return '2';
  return '';
}

export function anttEvidenceToCollectionOrderSnapshot(
  evidence: RiskEvidence,
  ownerFallback?: { cpf_cnpj?: string | null; city?: string | null; state?: string | null } | null
): CollectionOrderAnttData {
  const p = evidence.payload as Record<string, unknown>;

  const rawTransportador = (p.transportador as string) ?? null;
  const parsedType = resolveAnttRegistryType({
    rntrc_registry_type: (p.rntrc_registry_type as 'TAC' | 'ETC' | null) ?? null,
    transportador: rawTransportador,
  });
  const cleanTransportador = stripAnttTransportadorPrefix(rawTransportador);

  const ownerMunicipioUf =
    ownerFallback?.city || ownerFallback?.state
      ? [ownerFallback.city, ownerFallback.state].filter(Boolean).join('/')
      : null;

  const cpfFromPayload =
    (p.cpf_cnpj_mask as string | null) ?? (p.cpf_cnpj ? String(p.cpf_cnpj) : null) ?? null;

  return {
    situacao: (p.situacao as string) ?? null,
    situacao_raw: (p.situacao_raw as string) ?? null,
    rntrc_registry_type: parsedType,
    rntrc: (p.rntrc as string) ?? null,
    transportador: cleanTransportador,
    cpf_cnpj_mask: cpfFromPayload || ownerFallback?.cpf_cnpj || null,
    municipio_uf: ((p.municipio_uf as string) ?? null) || ownerMunicipioUf,
    cadastrado_desde: (p.cadastrado_desde as string) ?? null,
    apto: (p.apto as boolean | null) ?? null,
    veiculo_na_frota: (p.veiculo_na_frota as boolean | null) ?? null,
    comprovante_url: (p.comprovante_url as string) ?? null,
    comprovante_storage_path: (p.comprovante_storage_path as string) ?? null,
    checked_at: evidence.created_at ?? null,
  };
}
