/// <reference path="../_shared/deno.d.ts" />
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';

interface PriceTableInput {
  id?: string | 'new';
  name: string;
  modality: 'lotacao' | 'fracionado';
  valid_from?: string | null;
  valid_until?: string | null;
  active?: boolean;
}

interface PriceTableRowInput {
  km_from: number;
  km_to: number;
  cost_per_ton?: number | null;
  cost_per_kg?: number | null;
  cost_value_percent?: number | null;
  gris_percent?: number | null;
  tso_percent?: number | null;
  toll_percent?: number | null;
  ad_valorem_percent?: number | null;
  // LTL weight range columns
  weight_rate_10?: number | null;
  weight_rate_20?: number | null;
  weight_rate_30?: number | null;
  weight_rate_50?: number | null;
  weight_rate_70?: number | null;
  weight_rate_100?: number | null;
  weight_rate_150?: number | null;
  weight_rate_200?: number | null;
  weight_rate_above_200?: number | null;
}

interface ImportRequest {
  priceTable: PriceTableInput;
  rows: PriceTableRowInput[];
  importMode: 'replace' | 'upsert';
}

interface ImportResponse {
  success: boolean;
  priceTableId?: string;
  rowsTotal: number;
  rowsInserted: number;
  rowsUpdated: number;
  duplicatesRemoved: number;
  errors: string[];
}

function validatePercentage(value: number | null | undefined, fieldName: string): string | null {
  if (value === null || value === undefined) return null;
  if (value < 0 || value > 100) {
    return `${fieldName} deve estar entre 0 e 100 (valor recebido: ${value})`;
  }
  return null;
}

function validateRow(row: PriceTableRowInput, index: number): string[] {
  const errors: string[] = [];

  if (row.km_from === undefined || row.km_from === null) {
    errors.push(`Linha ${index + 1}: km_from é obrigatório`);
  }
  if (row.km_to === undefined || row.km_to === null) {
    errors.push(`Linha ${index + 1}: km_to é obrigatório`);
  }
  if (row.km_from !== undefined && row.km_to !== undefined && row.km_to < row.km_from) {
    errors.push(`Linha ${index + 1}: km_to (${row.km_to}) deve ser >= km_from (${row.km_from})`);
  }
  if (row.km_from !== undefined && row.km_from < 0) {
    errors.push(`Linha ${index + 1}: km_from deve ser >= 0`);
  }

  // Validate percentages
  const percentFields = [
    { value: row.cost_value_percent, name: 'cost_value_percent' },
    { value: row.gris_percent, name: 'gris_percent' },
    { value: row.tso_percent, name: 'tso_percent' },
    { value: row.toll_percent, name: 'toll_percent' },
    { value: row.ad_valorem_percent, name: 'ad_valorem_percent' },
  ];

  for (const field of percentFields) {
    const error = validatePercentage(field.value, field.name);
    if (error) {
      errors.push(`Linha ${index + 1}: ${error}`);
    }
  }

  return errors;
}

interface RangeWithIndex {
  km_from: number;
  km_to: number;
  index: number;
}

// Deduplicates rows by km_from-km_to key using "last-wins" strategy
function deduplicateRows(rows: PriceTableRowInput[]): {
  uniqueRows: PriceTableRowInput[];
  duplicatesRemoved: number;
} {
  const map = new Map<string, PriceTableRowInput>();
  for (const row of rows) {
    if (row.km_from === undefined || row.km_to === undefined) continue;
    const key = `${row.km_from}-${row.km_to}`;
    map.set(key, row); // last occurrence wins
  }
  return {
    uniqueRows: Array.from(map.values()),
    duplicatesRemoved: rows.length - map.size,
  };
}

function detectOverlappingRanges(rows: PriceTableRowInput[]): string[] {
  const errors: string[] = [];

  // Filter valid rows and add original index
  const validRanges: RangeWithIndex[] = rows
    .map((row, index) => ({
      km_from: row.km_from,
      km_to: row.km_to,
      index: index + 1, // 1-indexed for user display
    }))
    .filter((r) => r.km_from !== undefined && r.km_to !== undefined && r.km_to >= r.km_from);

  if (validRanges.length < 2) return errors;

  // Sort by km_from, then by km_to
  validRanges.sort((a, b) => {
    if (a.km_from !== b.km_from) return a.km_from - b.km_from;
    return a.km_to - b.km_to;
  });

  // Check for overlaps (after deduplication check, so we only look at distinct ranges)
  // Two ranges overlap if: prev.km_to >= next.km_from (for inclusive ranges)
  // But we want gaps, so valid means: next.km_from > prev.km_to (no overlap)
  // Overlap exists when: next.km_from <= prev.km_to

  // First deduplicate for overlap check (same range is a duplicate, not overlap)
  const uniqueRanges: RangeWithIndex[] = [];
  const seenKeys = new Set<string>();
  for (const range of validRanges) {
    const key = `${range.km_from}-${range.km_to}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRanges.push(range);
    }
  }

  for (let i = 1; i < uniqueRanges.length; i++) {
    const prev = uniqueRanges[i - 1];
    const curr = uniqueRanges[i];

    // Overlap if current starts before or at previous end
    if (curr.km_from <= prev.km_to) {
      errors.push(
        `Faixas sobrepostas: ${prev.km_from}-${prev.km_to} (linha ${prev.index}) e ${curr.km_from}-${curr.km_to} (linha ${curr.index})`
      );
    }
  }

  return errors;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[import-price-table] Request received');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[import-price-table] Missing Authorization header');
      return new Response(
        JSON.stringify({
          success: false,
          rowsTotal: 0,
          rowsInserted: 0,
          rowsUpdated: 0,
          errors: ['Não autorizado: token ausente'],
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT (respects RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[import-price-table] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({
          success: false,
          rowsTotal: 0,
          rowsInserted: 0,
          rowsUpdated: 0,
          errors: ['Não autorizado: usuário inválido'],
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[import-price-table] User authenticated:', user.id);

    // Parse request body
    const body: ImportRequest = await req.json();
    console.log(
      '[import-price-table] Importing table:',
      body.priceTable?.name,
      'with',
      body.rows?.length,
      'rows, mode:',
      body.importMode
    );

    const { priceTable, rows, importMode } = body;

    // Validate required fields
    const errors: string[] = [];

    if (!priceTable) {
      errors.push('priceTable é obrigatório');
    } else {
      if (!priceTable.name?.trim()) {
        errors.push('priceTable.name é obrigatório');
      }
      if (!priceTable.modality || !['lotacao', 'fracionado'].includes(priceTable.modality)) {
        errors.push('priceTable.modality deve ser "lotacao" ou "fracionado"');
      }
    }

    if (!rows || !Array.isArray(rows)) {
      errors.push('rows deve ser um array');
    } else if (rows.length === 0) {
      errors.push('rows não pode estar vazio');
    } else {
      // Validate each row individually
      rows.forEach((row, index) => {
        const rowErrors = validateRow(row, index);
        errors.push(...rowErrors);
      });
    }

    if (!importMode || !['replace', 'upsert'].includes(importMode)) {
      errors.push('importMode deve ser "replace" ou "upsert"');
    }

    // Return early if basic validation fails
    if (errors.length > 0) {
      console.error('[import-price-table] Basic validation errors:', errors);
      return new Response(
        JSON.stringify({
          success: false,
          rowsTotal: rows?.length || 0,
          rowsInserted: 0,
          rowsUpdated: 0,
          errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DEDUPLICATION: Remove duplicates using "last-wins" strategy
    const { uniqueRows, duplicatesRemoved } = deduplicateRows(rows);

    if (duplicatesRemoved > 0) {
      console.log(
        `[import-price-table] Deduplicação: ${duplicatesRemoved} linhas duplicadas removidas (last-wins)`
      );
    }

    // OVERLAP VALIDATION: Check for overlapping ranges AFTER deduplication
    const overlapErrors = detectOverlappingRanges(uniqueRows);

    console.log(
      `[import-price-table] Validação global: ${rows.length} linhas originais, ${uniqueRows.length} após deduplicação, ${overlapErrors.length} sobreposições`
    );

    if (overlapErrors.length > 0) {
      console.error('[import-price-table] Faixas sobrepostas detectadas:', overlapErrors);
      return new Response(
        JSON.stringify({
          success: false,
          rowsTotal: rows.length,
          duplicatesRemoved,
          rowsInserted: 0,
          rowsUpdated: 0,
          errors: overlapErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rowsTotal = rows.length;
    let rowsInserted = 0;
    let rowsUpdated = 0;
    let priceTableId: string;

    // Step 1: Create or update price_table
    const isNewTable = !priceTable.id || priceTable.id === 'new';

    if (isNewTable) {
      console.log('[import-price-table] Creating new price table');

      const { data: newTable, error: insertError } = await supabase
        .from('price_tables')
        .insert({
          name: priceTable.name.trim(),
          modality: priceTable.modality,
          methodology: priceTable.modality === 'fracionado' ? 'fracionado_ntc' : 'lotacao',
          valid_from: priceTable.valid_from || null,
          valid_until: priceTable.valid_until || null,
          active: false, // Will set active later if needed
          created_by: user.id,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[import-price-table] Error creating price table:', insertError);
        return new Response(
          JSON.stringify({
            success: false,
            rowsTotal,
            duplicatesRemoved,
            rowsInserted: 0,
            rowsUpdated: 0,
            errors: [`Erro ao criar tabela de preço: ${insertError.message}`],
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      priceTableId = newTable.id;
      console.log('[import-price-table] Created price table:', priceTableId);
    } else {
      priceTableId = priceTable.id as string;
      console.log('[import-price-table] Updating existing price table:', priceTableId);

      const { error: updateError } = await supabase
        .from('price_tables')
        .update({
          name: priceTable.name.trim(),
          modality: priceTable.modality,
          valid_from: priceTable.valid_from || null,
          valid_until: priceTable.valid_until || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', priceTableId);

      if (updateError) {
        console.error('[import-price-table] Error updating price table:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            rowsTotal,
            duplicatesRemoved,
            rowsInserted: 0,
            rowsUpdated: 0,
            errors: [`Erro ao atualizar tabela de preço: ${updateError.message}`],
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 2: Handle active flag (deactivate others first)
    if (priceTable.active === true) {
      console.log('[import-price-table] Setting table as active, deactivating others');

      // Deactivate other tables with same modality
      const { error: deactivateError } = await supabase
        .from('price_tables')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('modality', priceTable.modality)
        .neq('id', priceTableId);

      if (deactivateError) {
        console.error('[import-price-table] Error deactivating other tables:', deactivateError);
        // Continue anyway, might still work
      }

      // Activate the target table
      const { error: activateError } = await supabase
        .from('price_tables')
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq('id', priceTableId);

      if (activateError) {
        console.error('[import-price-table] Error activating table:', activateError);
        return new Response(
          JSON.stringify({
            success: false,
            priceTableId,
            rowsTotal,
            duplicatesRemoved,
            rowsInserted: 0,
            rowsUpdated: 0,
            errors: [`Erro ao ativar tabela: ${activateError.message}`],
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 3: Handle rows based on importMode
    if (importMode === 'replace') {
      console.log('[import-price-table] Replace mode: deleting existing rows');

      // Delete all existing rows for this table
      const { error: deleteError } = await supabase
        .from('price_table_rows')
        .delete()
        .eq('price_table_id', priceTableId);

      if (deleteError) {
        console.error('[import-price-table] Error deleting existing rows:', deleteError);
        return new Response(
          JSON.stringify({
            success: false,
            priceTableId,
            rowsTotal,
            duplicatesRemoved,
            rowsInserted: 0,
            rowsUpdated: 0,
            errors: [`Erro ao remover linhas existentes: ${deleteError.message}`],
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert deduplicated rows
      const rowsToInsert = uniqueRows.map((row) => ({
        price_table_id: priceTableId,
        km_from: row.km_from,
        km_to: row.km_to,
        cost_per_ton: row.cost_per_ton ?? null,
        cost_per_kg: row.cost_per_kg ?? null,
        cost_value_percent: row.cost_value_percent ?? null,
        gris_percent: row.gris_percent ?? null,
        tso_percent: row.tso_percent ?? null,
        toll_percent: row.toll_percent ?? null,
        ad_valorem_percent: row.ad_valorem_percent ?? null,
        // LTL weight range columns
        weight_rate_10: row.weight_rate_10 ?? null,
        weight_rate_20: row.weight_rate_20 ?? null,
        weight_rate_30: row.weight_rate_30 ?? null,
        weight_rate_50: row.weight_rate_50 ?? null,
        weight_rate_70: row.weight_rate_70 ?? null,
        weight_rate_100: row.weight_rate_100 ?? null,
        weight_rate_150: row.weight_rate_150 ?? null,
        weight_rate_200: row.weight_rate_200 ?? null,
        weight_rate_above_200: row.weight_rate_above_200 ?? null,
      }));

      const { error: insertRowsError } = await supabase
        .from('price_table_rows')
        .insert(rowsToInsert);

      if (insertRowsError) {
        console.error('[import-price-table] Error inserting rows:', insertRowsError);
        return new Response(
          JSON.stringify({
            success: false,
            priceTableId,
            rowsTotal,
            duplicatesRemoved,
            rowsInserted: 0,
            rowsUpdated: 0,
            errors: [`Erro ao inserir linhas: ${insertRowsError.message}`],
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      rowsInserted = uniqueRows.length;
      rowsUpdated = 0;
      console.log('[import-price-table] Replace complete:', { rowsInserted, duplicatesRemoved });
    } else {
      // Upsert mode - use already deduplicated uniqueRows
      console.log('[import-price-table] Upsert mode: checking existing rows');

      // Get existing row keys to calculate counts
      const { data: existingRows, error: fetchError } = await supabase
        .from('price_table_rows')
        .select('km_from, km_to')
        .eq('price_table_id', priceTableId);

      if (fetchError) {
        console.error('[import-price-table] Error fetching existing rows:', fetchError);
        // Continue anyway, counts might be off
      }

      // Create a set of existing keys for quick lookup
      const existingKeys = new Set((existingRows || []).map((r) => `${r.km_from}-${r.km_to}`));

      // Count how many incoming rows match existing keys (using deduplicated rows)
      const matchingKeys = uniqueRows.filter((r) =>
        existingKeys.has(`${r.km_from}-${r.km_to}`)
      ).length;

      rowsUpdated = matchingKeys;
      rowsInserted = uniqueRows.length - matchingKeys;

      console.log('[import-price-table] Upsert counts:', {
        rowsUpdated,
        rowsInserted,
        existingCount: existingKeys.size,
        originalRows: rows.length,
        uniqueRows: uniqueRows.length,
        duplicatesRemoved,
      });

      // Upsert deduplicated rows
      const rowsToUpsert = uniqueRows.map((row) => ({
        price_table_id: priceTableId,
        km_from: row.km_from,
        km_to: row.km_to,
        cost_per_ton: row.cost_per_ton ?? null,
        cost_per_kg: row.cost_per_kg ?? null,
        cost_value_percent: row.cost_value_percent ?? null,
        gris_percent: row.gris_percent ?? null,
        tso_percent: row.tso_percent ?? null,
        toll_percent: row.toll_percent ?? null,
        ad_valorem_percent: row.ad_valorem_percent ?? null,
        // LTL weight range columns
        weight_rate_10: row.weight_rate_10 ?? null,
        weight_rate_20: row.weight_rate_20 ?? null,
        weight_rate_30: row.weight_rate_30 ?? null,
        weight_rate_50: row.weight_rate_50 ?? null,
        weight_rate_70: row.weight_rate_70 ?? null,
        weight_rate_100: row.weight_rate_100 ?? null,
        weight_rate_150: row.weight_rate_150 ?? null,
        weight_rate_200: row.weight_rate_200 ?? null,
        weight_rate_above_200: row.weight_rate_above_200 ?? null,
      }));

      const { error: upsertError } = await supabase.from('price_table_rows').upsert(rowsToUpsert, {
        onConflict: 'price_table_id,km_from,km_to',
        ignoreDuplicates: false,
      });

      if (upsertError) {
        console.error('[import-price-table] Error upserting rows:', upsertError);
        return new Response(
          JSON.stringify({
            success: false,
            priceTableId,
            rowsTotal,
            duplicatesRemoved,
            rowsInserted: 0,
            rowsUpdated: 0,
            errors: [`Erro ao inserir/atualizar linhas: ${upsertError.message}`],
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[import-price-table] Upsert complete');
    }

    const response: ImportResponse = {
      success: true,
      priceTableId,
      rowsTotal,
      rowsInserted,
      rowsUpdated,
      duplicatesRemoved,
      errors: [],
    };

    console.log('[import-price-table] Success:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[import-price-table] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        rowsTotal: 0,
        rowsInserted: 0,
        rowsUpdated: 0,
        errors: [`Erro inesperado: ${errorMessage}`],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
