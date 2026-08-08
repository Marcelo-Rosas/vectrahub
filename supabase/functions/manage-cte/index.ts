// @ts-nocheck
/**
 * manage-cte: consult, cancel, and carta-de-correção for an existing CT-e.
 *
 * Body shapes:
 *   { action: "consult", emission_id: string }
 *   { action: "cancel", emission_id: string, justificativa: string }   // 15-255 chars
 *   { action: "cce", emission_id: string, correcoes: Array<{ grupo_alterado, campo_alterado, valor_alterado }> }
 *
 * Auth: requires authenticated Supabase user (JWT). RBAC enforced via RLS
 * (admin/financeiro can UPDATE cte_emissions).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { FocusClient, type FocusAmbiente } from '../_shared/focus-client.ts';
import { normalizeSefazJustificativa } from '../_shared/sefaz-justificativa.ts';

function envOrThrow(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`[manage-cte] missing env: ${key}`);
  return v;
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  // Auth
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors);
  const userJwt = authHeader.slice('Bearer '.length);

  const supabaseUrl = envOrThrow('SUPABASE_URL');
  const serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = envOrThrow('SUPABASE_ANON_KEY');

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user)
    return json({ error: 'unauthorized', detail: userErr?.message }, 401, cors);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }
  const action = String(body.action ?? '');
  const emissionId = String(body.emission_id ?? '');
  if (!emissionId) return json({ error: 'emission_id_required' }, 400, cors);

  const { data: emission, error: emErr } = await supabase
    .from('cte_emissions')
    .select('*')
    .eq('id', emissionId)
    .single();
  if (emErr || !emission)
    return json({ error: 'emission_not_found', detail: emErr?.message }, 404, cors);

  const ambiente = emission.ambiente as FocusAmbiente;
  const focus = new FocusClient({ ambiente });
  const ref = emission.ref as string;

  if (action === 'consult') {
    const resp = await focus.consultCte(ref);
    // Mirror to DB if status changed
    const focusStatus = String(resp.body.status ?? '');
    const newStatus =
      focusStatus === 'autorizado'
        ? 'authorized'
        : focusStatus === 'cancelado'
          ? 'cancelled'
          : focusStatus === 'erro_autorizacao'
            ? 'rejected'
            : focusStatus === 'processando_autorizacao'
              ? 'processing'
              : null;
    if (newStatus && newStatus !== emission.status) {
      await supabase
        .from('cte_emissions')
        .update({
          status: newStatus,
          status_sefaz: resp.body.status_sefaz ?? null,
          chave_cte: resp.body.chave ?? emission.chave_cte,
          protocolo: resp.body.protocolo ?? resp.body.numero_protocolo ?? emission.protocolo,
          response_received: resp.body,
        })
        .eq('id', emissionId);
    }
    return json(
      {
        ok: true,
        focus_status: resp.status,
        focus_body: resp.body,
        db_status: newStatus ?? emission.status,
      },
      200,
      cors
    );
  }

  if (action === 'cancel') {
    const just = normalizeSefazJustificativa(body.justificativa);
    if (!just.ok) {
      return json({ error: 'invalid_justificativa', detail: just.detail }, 400, cors);
    }
    const justificativa = just.value;
    if (emission.status !== 'authorized') {
      return json(
        {
          error: 'invalid_state',
          detail: `cancel requires status=authorized, got ${emission.status}`,
        },
        409,
        cors
      );
    }
    const resp = await focus.cancelCte(ref, justificativa);
    if (resp.status >= 400) {
      const focusMsg = typeof resp.body?.mensagem === 'string' ? resp.body.mensagem : null;
      return json(
        {
          error: 'focus_cancel_failed',
          detail: focusMsg ?? 'Focus rejeitou o cancelamento',
          focus_status: resp.status,
          focus_body: resp.body,
        },
        resp.status === 422 ? 422 : 502,
        cors
      );
    }
    await supabase
      .from('cte_emissions')
      .update({
        status: 'cancelled',
        data_cancelamento: new Date().toISOString(),
        justificativa_cancelamento: justificativa,
        response_received: resp.body,
      })
      .eq('id', emissionId);
    return json({ ok: true, focus_status: resp.status, focus_body: resp.body }, 200, cors);
  }

  if (action === 'cce') {
    const correcoes = Array.isArray(body.correcoes) ? body.correcoes : [];
    if (correcoes.length === 0) return json({ error: 'correcoes_required' }, 400, cors);
    if (emission.status !== 'authorized') {
      return json(
        {
          error: 'invalid_state',
          detail: `cce requires status=authorized, got ${emission.status}`,
        },
        409,
        cors
      );
    }
    const resp = await focus.cartaCorrecaoCte(ref, correcoes as any);
    if (resp.status >= 400) {
      return json(
        { error: 'focus_cce_failed', focus_status: resp.status, focus_body: resp.body },
        502,
        cors
      );
    }
    return json({ ok: true, focus_status: resp.status, focus_body: resp.body }, 200, cors);
  }

  return json(
    { error: 'invalid_action', detail: `expected consult|cancel|cce, got ${action}` },
    400,
    cors
  );
});
