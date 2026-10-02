/**
 * send-ms-liberacao-email: envia à MS Seguros / Fairfax o formulário oficial
 * "Liberação de embarque excepcional" (DOCX preenchido) de um insurance_exception_requests.
 *
 * Body: { requestId: string, to?, cc?, message?, resend?: boolean }
 *
 * Após o envio: status=sent, response_deadline = fim do 3º dia útil (aceite tácito depois disso).
 * emit-cte / emit-mdfe seguem bloqueados até accepted ou prazo vencido.
 */
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isUuid } from '../_shared/quote-email-format.ts';
import {
  AVERBA_MS_CC_DEFAULT,
  AVERBA_MS_TO_DEFAULT,
  parseEmailList,
} from '../_shared/averba-ms-email.ts';
import { validateMsForm, type MsLiberacaoForm } from '../_shared/ms-liberacao-form.ts';
import { buildMsLiberacaoDocx, bytesToB64 } from '../_shared/ms-liberacao-docx.ts';
import { responseDeadline } from '../_shared/insurance-exception.ts';
import { buildMsLiberacaoHtml } from '../_shared/ms-liberacao-email.ts';

interface RequestBody {
  requestId: string;
  to?: string | string[];
  cc?: string | string[];
  message?: string;
  /** Reenvio de pedido já enviado (corrige dados) — recalcula o prazo. */
  resend?: boolean;
}

const BUCKET = 'insurance-exceptions';
const DOUBLE_SEND_WINDOW_MS = 2 * 60 * 1000;

/** `sub` do JWT (assinatura validada pelo PostgREST na leitura com RLS). */
function jwtSub(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1];
    if (!part) return null;
    const b64 = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');
    const sub = JSON.parse(atob(b64))?.sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401, corsHeaders);

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }
    if (!body?.requestId || !isUuid(body.requestId)) {
      return json({ error: 'Invalid requestId' }, 400, corsHeaders);
    }

    const to = parseEmailList(body.to?.length ? body.to : [...AVERBA_MS_TO_DEFAULT]);
    const cc = parseEmailList(body.cc ?? [...AVERBA_MS_CC_DEFAULT]);
    if (to.length === 0)
      return json({ error: 'Informe ao menos um destinatário' }, 400, corsHeaders);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom =
      Deno.env.get('RESEND_FROM')?.trim() || 'Vectra Cargo <cotacao@vectracargo.com.br>';
    if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500, corsHeaders);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Autenticação = mesma do send-averba-ms-email: leitura via PostgREST com o JWT do usuário.
    // PostgREST valida assinatura/expiração e a RLS exige perfil; auth.getUser() dentro do
    // runtime devolvia HTML (gateway interno) e quebrava com 401 para todo usuário.
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const userId = jwtSub(jwt);
    if (!userId) return json({ error: 'unauthorized', detail: 'JWT sem sub' }, 401, corsHeaders);

    const userSb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const adminSb = createClient(supabaseUrl, serviceKey);

    const { data: request, error: rErr } = await userSb
      .from('insurance_exception_requests')
      .select('*')
      .eq('id', body.requestId)
      .maybeSingle();
    if (rErr) return json({ error: 'unauthorized', detail: rErr.message }, 401, corsHeaders);
    if (!request) return json({ error: 'Pedido não encontrado' }, 404, corsHeaders);

    if (!['draft', 'sent'].includes(request.status)) {
      return json(
        { error: `Pedido em status '${request.status}' não pode ser enviado` },
        409,
        corsHeaders
      );
    }
    if (request.status === 'sent' && !body.resend) {
      return json(
        { error: 'Pedido já enviado — use reenvio para corrigir dados' },
        409,
        corsHeaders
      );
    }
    if (request.sent_at && Date.now() - Date.parse(request.sent_at) < DOUBLE_SEND_WINDOW_MS) {
      return json(
        { error: 'Pedido enviado há menos de 2 minutos — aguarde para reenviar' },
        409,
        corsHeaders
      );
    }

    const form = (request.form_data ?? { text: {}, checks: {} }) as MsLiberacaoForm;
    const errors = validateMsForm(form);
    if (errors.length) return json({ error: 'Formulário incompleto', errors }, 422, corsHeaders);

    const docx = buildMsLiberacaoDocx(form);
    const sentAt = new Date();
    const stamp = sentAt.toISOString().replace(/[:.]/g, '-');
    const plate = String(form.text?.placa ?? request.vehicle_plate ?? '').toUpperCase();
    const filename = `Liberacao-Excepcional-${plate || 'veiculo'}-${stamp.slice(0, 10)}.docx`;
    const storagePath = `${request.id}/${stamp}.docx`;

    const { error: upErr } = await adminSb.storage.from(BUCKET).upload(storagePath, docx, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });
    if (upErr) return json({ error: `Falha ao salvar DOCX: ${upErr.message}` }, 500, corsHeaders);

    const deadline = responseDeadline(sentAt);
    const html = buildMsLiberacaoHtml({
      form,
      deadline,
      resend: request.status === 'sent',
      message: typeof body.message === 'string' ? body.message : undefined,
    });

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: resendFrom,
        to,
        ...(cc.length ? { cc } : {}),
        subject: `${request.status === 'sent' ? '[REENVIO] ' : ''}Liberação de embarque excepcional — ${plate || 'veículo'} — ${form.text?.mercadoria_valor ?? ''} — Vectra Hub`,
        html,
        attachments: [{ filename, content: bytesToB64(docx) }],
      }),
    });
    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      return json({ error: `Resend error: ${resendError}` }, 502, corsHeaders);
    }
    const resendData = (await resendRes.json()) as { id?: string };

    const { error: updErr } = await adminSb
      .from('insurance_exception_requests')
      .update({
        status: 'sent',
        sent_at: sentAt.toISOString(),
        sent_by: userId,
        response_deadline: deadline.toISOString(),
        email_to: to,
        email_cc: cc,
        email_message_id: resendData.id ?? null,
        docx_storage_path: `${BUCKET}/${storagePath}`,
      })
      .eq('id', request.id);
    if (updErr) {
      // E-mail já saiu: não reenviar; registrar manualmente.
      return json(
        {
          error: `E-mail enviado (id ${resendData.id}) mas falhou ao gravar status: ${updErr.message}`,
        },
        500,
        corsHeaders
      );
    }

    return json(
      {
        success: true,
        emailId: resendData.id,
        responseDeadline: deadline.toISOString(),
        docxPath: storagePath,
      },
      200,
      corsHeaders
    );
  } catch (e) {
    return json({ error: String(e) }, 500, corsHeaders);
  }
});
