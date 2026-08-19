// @ts-nocheck
/**
 * manage-mdfe: consult, encerrar, and cancel for an existing MDF-e.
 *
 * Body shapes:
 *   { action: "consult", emission_id: string }
 *   { action: "encerrar", emission_id: string, uf: string, codigo_municipio: number }
 *   { action: "cancel", emission_id: string, justificativa: string }   // 15-255 chars
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { FocusClient, type FocusAmbiente } from '../_shared/focus-client.ts';
import { normalizeSefazJustificativa } from '../_shared/sefaz-justificativa.ts';

function envOrThrow(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`[manage-mdfe] missing env: ${key}`);
  return v;
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

function pickProtocolo(body: Record<string, unknown>, fallback: string | null): string | null {
  for (const key of [
    'protocolo',
    'numero_protocolo',
    'protocolo_sefaz',
    'numero_protocolo_autorizacao',
  ]) {
    const v = body[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return fallback;
}

function nProtFromXml(xml: string): string | null {
  const m = xml.match(/<nProt>(\d{15})<\/nProt>/);
  return m?.[1] ?? null;
}

async function protocoloFromXmlUrl(url: unknown): Promise<string | null> {
  if (typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return nProtFromXml(await r.text());
  } catch {
    return null;
  }
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
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401, cors);

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
    .from('mdfe_emissions')
    .select('*')
    .eq('id', emissionId)
    .single();
  if (emErr || !emission) return json({ error: 'emission_not_found' }, 404, cors);

  const ambiente = emission.ambiente as FocusAmbiente;
  const focus = new FocusClient({ ambiente });
  const ref = emission.ref as string;

  // ============================================================
  // consult
  // ============================================================
  if (action === 'consult') {
    const resp = await focus.consultMdfe(ref);
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
    let protocolo = pickProtocolo(resp.body as Record<string, unknown>, emission.protocolo ?? null);
    if (!protocolo) {
      protocolo = await protocoloFromXmlUrl((resp.body as Record<string, unknown>).caminho_xml);
    }
    const patch: Record<string, unknown> = {
      status_sefaz: resp.body.status_sefaz ?? emission.status_sefaz,
      chave_mdfe: resp.body.chave ?? emission.chave_mdfe,
      protocolo,
      response_received: resp.body,
    };
    if (newStatus && newStatus !== emission.status) patch.status = newStatus;
    await supabase.from('mdfe_emissions').update(patch).eq('id', emissionId);
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

  // ============================================================
  // encerrar (after cargo discharge)
  // ============================================================
  if (action === 'encerrar') {
    const uf = String(body.uf ?? '');
    const codigoMunicipio = Number(body.codigo_municipio);
    if (!uf || !codigoMunicipio) {
      return json({ error: 'uf_and_codigo_municipio_required' }, 400, cors);
    }
    if (emission.status !== 'authorized') {
      return json(
        {
          error: 'invalid_state',
          detail: `encerrar requires status=authorized, got ${emission.status}`,
        },
        409,
        cors
      );
    }
    const ibgeNames: Record<number, string> = {
      2304400: 'Fortaleza',
      2309607: 'Pacajus',
    };
    const nomeMunicipio = String(body.nome_municipio ?? ibgeNames[codigoMunicipio] ?? '').trim();
    if (!nomeMunicipio) {
      return json({ error: 'nome_municipio_required' }, 400, cors);
    }
    const dataEncerrar = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const resp = await focus.encerrarMdfe(ref, {
      data: dataEncerrar,
      sigla_uf: uf,
      nome_municipio: nomeMunicipio,
    });
    if (resp.status >= 400) {
      return json(
        { error: 'focus_encerrar_failed', focus_status: resp.status, focus_body: resp.body },
        502,
        cors
      );
    }
    await supabase
      .from('mdfe_emissions')
      .update({
        status: 'encerrado',
        encerrado_at: new Date().toISOString(),
        municipio_descarga_ibge: codigoMunicipio,
        response_received: resp.body,
      })
      .eq('id', emissionId);
    return json({ ok: true, focus_status: resp.status, focus_body: resp.body }, 200, cors);
  }

  // ============================================================
  // cancel
  // ============================================================
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
    const resp = await focus.cancelMdfe(ref, justificativa);
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
      .from('mdfe_emissions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        justificativa_cancelamento: justificativa,
        response_received: resp.body,
      })
      .eq('id', emissionId);
    return json({ ok: true, focus_status: resp.status, focus_body: resp.body }, 200, cors);
  }

  return json(
    { error: 'invalid_action', detail: `expected consult|encerrar|cancel, got ${action}` },
    400,
    cors
  );
});
