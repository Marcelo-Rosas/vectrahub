/// <reference path="../_shared/deno.d.ts" />
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchCompanySettings } from '../_shared/company-settings.ts';
import { renderContractPdf } from './contract-renderer.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as { quote_id: string; force_regenerate?: boolean };
    const { quote_id, force_regenerate = false } = body;

    if (!quote_id) {
      return new Response(JSON.stringify({ error: 'quote_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check idempotency: return existing contract if it exists and not forcing
    if (!force_regenerate) {
      const { data: existing } = await sb
        .from('quote_contracts')
        .select('id, pdf_storage_path, pdf_file_name, version')
        .eq('quote_id', quote_id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data: signedUrl } = await sb.storage
          .from('documents')
          .createSignedUrl(existing.pdf_storage_path, 300);

        return new Response(
          JSON.stringify({
            contract_id: existing.id,
            pdf_storage_path: existing.pdf_storage_path,
            pdf_file_name: existing.pdf_file_name,
            version: existing.version,
            signed_url: signedUrl?.signedUrl ?? null,
            already_existed: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Load quote + client + payment_terms
    const { data: quote, error: quoteError } = await sb
      .from('quotes')
      .select(
        `
        id, quote_code, client_id, client_name, client_email,
        freight_type, shipper_id, shipper_name,
        origin, destination, cargo_type, weight, volume,
        value, payment_term_id, estimated_loading_date, validity_date,
        advance_due_date, balance_due_date, stage,
        pricing_breakdown, conditional_fees_breakdown,
        payment_terms:payment_term_id (name, days, advance_percent),
        clients:client_id (
          name, cnpj, address, city, state, zip_code, zip_code_mask,
          state_registration, legal_representative_name,
          legal_representative_cpf, legal_representative_role,
          address_number, address_complement, address_neighborhood
        ),
        shippers:shipper_id (
          name, cnpj, address, city, state, zip_code,
          state_registration, legal_representative_name,
          legal_representative_cpf, legal_representative_role,
          address_number, address_complement, address_neighborhood
        )
      `
      )
      .eq('id', quote_id)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (quote.stage !== 'ganho') {
      return new Response(
        JSON.stringify({ error: 'Contract can only be generated for won quotes (stage: ganho)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load company settings
    const company = await fetchCompanySettings(sb);
    if (!company) {
      return new Response(JSON.stringify({ error: 'company_settings not configured' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine next version
    const { data: lastContract } = await sb
      .from('quote_contracts')
      .select('version')
      .eq('quote_id', quote_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (lastContract?.version ?? 0) + 1;

    // Generate PDF
    const pdfBytes = await renderContractPdf({ quote, company, version });

    // Upload to storage
    const timestamp = Date.now();
    const storagePath = `contracts/${quote_id}/v${version}-${timestamp}.pdf`;
    const fileName = `${quote.quote_code ?? quote_id}_contrato_v${version}.pdf`;

    const { error: uploadError } = await sb.storage
      .from('documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Insert quote_contracts record
    const { data: contractRecord, error: insertError } = await sb
      .from('quote_contracts')
      .insert({
        quote_id,
        version,
        pdf_storage_path: storagePath,
        pdf_file_name: fileName,
        pdf_size_bytes: pdfBytes.byteLength,
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to insert contract record: ${insertError.message}`);
    }

    // Return signed URL
    const { data: signedUrl } = await sb.storage
      .from('documents')
      .createSignedUrl(storagePath, 300);

    return new Response(
      JSON.stringify({
        contract_id: contractRecord.id,
        pdf_storage_path: storagePath,
        pdf_file_name: fileName,
        version,
        signed_url: signedUrl?.signedUrl ?? null,
        already_existed: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[generate-contract-pdf] error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
