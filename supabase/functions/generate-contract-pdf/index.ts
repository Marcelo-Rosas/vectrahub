/// <reference path="../_shared/deno.d.ts" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchCompanySettings } from '../_shared/company-settings.ts';
import {
  type ContractSplitItem,
  contractSplitsSumCents,
  quoteValueToCents,
} from '../_shared/contract-split.ts';
import { renderContractPdf } from './contract-renderer.ts';
import {
  buildCanonicalFilename,
  ctrCodeFromQuoteCode,
  isLegacyContractFilename,
  resolveContractContratante,
  resolveContractContratanteFromSplit,
} from './contract-clause-helpers.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TIMEOUT_MS = 40_000;

const CLIENT_PARTY_SELECT =
  'name, cnpj, address, city, state, zip_code, zip_code_mask, state_registration, legal_representative_name, legal_representative_cpf, legal_representative_role, address_number, address_complement, address_neighborhood';

const SHIPPER_PARTY_SELECT =
  'name, cnpj, address, city, state, zip_code, state_registration, legal_representative_name, legal_representative_cpf, legal_representative_role, address_number, address_complement, address_neighborhood';

interface RequestBody {
  quote_id: string;
  force_regenerate?: boolean;
  sequence?: number;
  quote_updated_at?: string;
}

interface ContractResultRow {
  contract_id: string;
  sequence: number;
  pdf_file_name: string;
  pdf_storage_path: string;
  version: number;
  signed_url: string | null;
  already_existed: boolean;
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseContractSplits(raw: unknown): ContractSplitItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      sequence: Number(item.sequence) || 1,
      party_type: item.party_type === 'shipper' ? 'shipper' : 'client',
      party_id: String(item.party_id ?? ''),
      name: String(item.name ?? ''),
      amount_cents: Number(item.amount_cents) || 0,
      basis:
        item.basis === 'lotacao_km' ? ('lotacao_km' as const) : ('fracionado_peso_valor' as const),
      weight_kg: item.weight_kg != null ? Number(item.weight_kg) : undefined,
      cargo_value_cents:
        item.cargo_value_cents != null ? Number(item.cargo_value_cents) : undefined,
      km: item.km != null ? Number(item.km) : null,
      calculated_at: String(item.calculated_at ?? new Date().toISOString()),
    }))
    .filter((item) => item.party_id && item.name)
    .sort((a, b) => a.sequence - b.sequence);
}

function buildLegacySingleSplit(quote: Record<string, unknown>): ContractSplitItem[] {
  const isCif =
    String(quote.freight_type ?? '')
      .trim()
      .toUpperCase() === 'CIF';
  const party_type = isCif ? ('shipper' as const) : ('client' as const);
  const party_id = String(isCif ? quote.shipper_id : (quote.client_id ?? ''));
  const name = String(
    isCif ? (quote.shipper_name ?? '[embarcador]') : (quote.client_name ?? '[cliente]')
  );
  return [
    {
      sequence: 1,
      party_type,
      party_id,
      name,
      amount_cents: quoteValueToCents(Number(quote.value)),
      basis: 'fracionado_peso_valor',
      calculated_at: new Date().toISOString(),
    },
  ];
}

async function loadPartyRecord(
  sb: SupabaseClient,
  party_type: 'client' | 'shipper',
  party_id: string
): Promise<Record<string, unknown>> {
  if (party_type === 'client') {
    const { data } = await sb
      .from('clients')
      .select(CLIENT_PARTY_SELECT)
      .eq('id', party_id)
      .maybeSingle();
    return (data as Record<string, unknown> | null) ?? {};
  }
  const { data } = await sb
    .from('shippers')
    .select(SHIPPER_PARTY_SELECT)
    .eq('id', party_id)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? {};
}

async function lockQuote(
  sb: SupabaseClient,
  quote_id: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await sb.rpc('lock_quote_for_contract', { p_quote_id: quote_id });
  if (error) {
    console.warn('[generate-contract-pdf] lock_quote_for_contract fallback:', error.message);
    const { data: quote, error: qErr } = await sb
      .from('quotes')
      .select('*')
      .eq('id', quote_id)
      .single();
    if (qErr || !quote) return null;
    return quote as Record<string, unknown>;
  }
  const rows = data as Record<string, unknown>[] | null;
  return rows?.[0] ?? null;
}

async function loadQuoteGraph(sb: SupabaseClient, quote_id: string) {
  const { data, error } = await sb
    .from('quotes')
    .select(
      `
        id, quote_code, client_id, client_name, client_email,
        freight_type, freight_modality, shipper_id, shipper_name,
        origin, destination, cargo_type, weight, volume,
        value, payment_term_id, estimated_loading_date, validity_date,
        advance_due_date, balance_due_date, stage, updated_at,
        contract_splits, pricing_breakdown, conditional_fees_breakdown,
        payment_terms:payment_term_id (name, days, advance_percent),
        clients:client_id (${CLIENT_PARTY_SELECT}),
        shippers:shipper_id (${SHIPPER_PARTY_SELECT})
      `
    )
    .eq('id', quote_id)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

async function generateOneContract(
  sb: SupabaseClient,
  quote: Record<string, unknown>,
  company: Record<string, unknown>,
  split: ContractSplitItem,
  force_regenerate: boolean,
  splitsCount: number
): Promise<ContractResultRow> {
  const quote_id = String(quote.id);
  const seq = split.sequence;

  const { data: existing } = await sb
    .from('quote_contracts')
    .select('id, pdf_storage_path, pdf_file_name, version, split_snapshot')
    .eq('quote_id', quote_id)
    .eq('sequence', seq)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasModernSplit =
    existing?.split_snapshot &&
    typeof existing.split_snapshot === 'object' &&
    Object.keys(existing.split_snapshot as object).length > 0;

  const multiPayer = splitsCount > 1;

  if (
    existing &&
    !force_regenerate &&
    !isLegacyContractFilename(existing.pdf_file_name) &&
    (!multiPayer || hasModernSplit)
  ) {
    const { data: signedUrl } = await sb.storage
      .from('documents')
      .createSignedUrl(existing.pdf_storage_path, 300);
    return {
      contract_id: existing.id,
      sequence: seq,
      pdf_storage_path: existing.pdf_storage_path,
      pdf_file_name: existing.pdf_file_name ?? '',
      version: existing.version,
      signed_url: signedUrl?.signedUrl ?? null,
      already_existed: true,
    };
  }

  const { data: lastForSeq } = await sb
    .from('quote_contracts')
    .select('version')
    .eq('quote_id', quote_id)
    .eq('sequence', seq)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (lastForSeq?.version ?? 0) + 1;
  const partyRecord = await loadPartyRecord(sb, split.party_type, split.party_id);
  const contratante = resolveContractContratanteFromSplit(quote, {
    party_type: split.party_type,
    name: split.name,
    party: partyRecord,
  });

  let pdfBytes: Uint8Array | null = await renderContractPdf({
    quote,
    company,
    version,
    leg: {
      sequence: seq,
      amount_cents: split.amount_cents,
      contratante,
    },
  });

  const pdfSizeBytes = pdfBytes.byteLength;
  const timestamp = Date.now();
  const storagePath = `contracts/${quote_id}/${seq}/v${version}-${timestamp}.pdf`;
  const ctrCode = ctrCodeFromQuoteCode(quote.quote_code as string | null | undefined, seq);
  const fileName = buildCanonicalFilename(ctrCode, split.name);

  const { error: uploadError } = await sb.storage.from('documents').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: false,
  });

  pdfBytes = null;

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: contractRecord, error: insertError } = await sb
    .from('quote_contracts')
    .insert({
      quote_id,
      version,
      sequence: seq,
      party_type: split.party_type,
      party_id: split.party_id,
      amount_cents: split.amount_cents,
      split_snapshot: {
        ...split,
        freight_type: quote.freight_type,
      },
      pdf_storage_path: storagePath,
      pdf_file_name: fileName,
      pdf_size_bytes: pdfSizeBytes,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert contract record: ${insertError.message}`);
  }

  const { data: signedUrl } = await sb.storage.from('documents').createSignedUrl(storagePath, 300);

  return {
    contract_id: contractRecord.id,
    sequence: seq,
    pdf_storage_path: storagePath,
    pdf_file_name: fileName,
    version,
    signed_url: signedUrl?.signedUrl ?? null,
    already_existed: false,
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const body = (await req.json()) as RequestBody;
    const { quote_id, force_regenerate = false, sequence, quote_updated_at } = body;

    if (!quote_id) {
      return jsonResponse({ error: 'quote_id is required' }, 400, corsHeaders);
    }

    const locked = await lockQuote(sb, quote_id);
    if (!locked) {
      return jsonResponse({ error: 'QUOTE_NOT_FOUND' }, 404, corsHeaders);
    }

    if (String(locked.stage) !== 'ganho') {
      return jsonResponse({ error: 'QUOTE_NOT_WON' }, 400, corsHeaders);
    }

    if (quote_updated_at && String(locked.updated_at) !== quote_updated_at) {
      return jsonResponse({ error: 'QUOTE_CHANGED' }, 409, corsHeaders);
    }

    const quote = await loadQuoteGraph(sb, quote_id);
    if (!quote) {
      return jsonResponse({ error: 'QUOTE_NOT_FOUND' }, 404, corsHeaders);
    }

    let splits = parseContractSplits(quote.contract_splits);
    if (splits.length === 0) {
      splits = buildLegacySingleSplit(quote);
    }

    const expectedTotal = quoteValueToCents(Number(quote.value));
    if (contractSplitsSumCents(splits) !== expectedTotal) {
      return jsonResponse(
        {
          error: 'SPLIT_SUM_MISMATCH',
          expected_cents: expectedTotal,
          actual_cents: contractSplitsSumCents(splits),
        },
        409,
        corsHeaders
      );
    }

    const company = await fetchCompanySettings(sb);
    if (!company) {
      return jsonResponse({ error: 'company_settings not configured' }, 409, corsHeaders);
    }

    const targetSequences = sequence
      ? splits.filter((s) => s.sequence === sequence).map((s) => s.sequence)
      : splits.map((s) => s.sequence);

    if (sequence && targetSequences.length === 0) {
      return jsonResponse({ error: 'SEQUENCE_NOT_FOUND' }, 404, corsHeaders);
    }

    const startedAt = Date.now();
    const contracts: ContractResultRow[] = [];
    const failed_sequences: number[] = [];
    const errors: Array<{ sequence: number; message: string }> = [];
    let timeoutOccurred = false;

    for (const seq of targetSequences) {
      if (Date.now() - startedAt > TIMEOUT_MS) {
        timeoutOccurred = true;
        failed_sequences.push(
          ...targetSequences.filter((s) => !contracts.some((c) => c.sequence === s) && s >= seq)
        );
        break;
      }

      const split = splits.find((s) => s.sequence === seq);
      if (!split) continue;

      try {
        const row = await generateOneContract(
          sb,
          quote,
          company,
          split,
          force_regenerate,
          splits.length
        );
        contracts.push(row);
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        failed_sequences.push(seq);
        errors.push({ sequence: seq, message });
      }
    }

    const pending = targetSequences.filter(
      (s) => !contracts.some((c) => c.sequence === s) && !failed_sequences.includes(s)
    );
    for (const s of pending) {
      if (!failed_sequences.includes(s)) failed_sequences.push(s);
    }

    const isHardFailure = targetSequences.length > 0 && contracts.length === 0 && !timeoutOccurred;

    if (isHardFailure) {
      return jsonResponse({ error: 'HARD_FAILURE', details: errors }, 500, corsHeaders);
    }

    const partial = failed_sequences.length > 0 || timeoutOccurred;

    return jsonResponse(
      {
        contract_id: contracts[0]?.contract_id ?? null,
        partial,
        timeout: timeoutOccurred,
        success_count: contracts.length,
        failed_sequences: [...new Set(failed_sequences)],
        errors,
        contracts,
        // compat campos legados (primeiro contrato)
        pdf_storage_path: contracts[0]?.pdf_storage_path,
        pdf_file_name: contracts[0]?.pdf_file_name,
        version: contracts[0]?.version,
        signed_url: contracts[0]?.signed_url ?? null,
        already_existed: contracts.length === 1 && contracts[0]?.already_existed === true,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error('[generate-contract-pdf] error:', err);
    return jsonResponse({ error: (err as Error).message }, 500, corsHeaders);
  }
});
