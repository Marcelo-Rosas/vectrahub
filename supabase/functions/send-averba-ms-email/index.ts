import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { bytesToBase64, isUuid } from '../_shared/quote-email-format.ts';
import {
  AVERBA_MS_CC_DEFAULT,
  AVERBA_MS_TO_DEFAULT,
  buildAverbaMsCsv,
  buildAverbaMsHtml,
  formatPtDate,
  parseEmailList,
  type AverbaMsRow,
} from '../_shared/averba-ms-email.ts';

interface RequestBody {
  quoteId: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  vehiclePlate?: string;
}

type CteRow = {
  id: string;
  numero: number | null;
  chave_cte: string | null;
  data_autorizacao: string | null;
  xml_storage_path: string | null;
  payload_sent: Record<string, unknown> | null;
  ref: string | null;
};

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

    if (!body?.quoteId || !isUuid(body.quoteId)) {
      return json({ error: 'Invalid quoteId' }, 400, corsHeaders);
    }

    const to = parseEmailList(body.to?.length ? body.to : [...AVERBA_MS_TO_DEFAULT]);
    const cc = parseEmailList(body.cc ?? [...AVERBA_MS_CC_DEFAULT]);
    const bcc = parseEmailList(body.bcc);
    if (to.length === 0)
      return json({ error: 'Informe ao menos um destinatário' }, 400, corsHeaders);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom =
      Deno.env.get('RESEND_FROM')?.trim() || 'Vectra Cargo <cotacao@vectracargo.com.br>';
    if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500, corsHeaders);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const userSb = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });
    const adminSb = serviceKey ? createClient(supabaseUrl, serviceKey) : userSb;

    const { data: quote, error: qErr } = await userSb
      .from('quotes')
      .select('id, quote_code')
      .eq('id', body.quoteId)
      .maybeSingle();
    if (qErr || !quote) return json({ error: 'Cotação não encontrada' }, 404, corsHeaders);

    const { data: ctes, error: cErr } = await userSb
      .from('cte_emissions')
      .select('id, numero, chave_cte, data_autorizacao, xml_storage_path, payload_sent, ref')
      .eq('quote_id', body.quoteId)
      .eq('status', 'authorized')
      .order('numero', { ascending: true });
    if (cErr) return json({ error: cErr.message }, 500, corsHeaders);
    const authorized = (ctes ?? []) as CteRow[];
    if (authorized.length === 0) {
      return json({ error: 'Nenhum CT-e autorizado para averbação' }, 422, corsHeaders);
    }

    let plate = String(body.vehiclePlate ?? '')
      .replace(/\s|-/g, '')
      .toUpperCase();
    if (!plate) {
      const { data: order } = await userSb
        .from('orders')
        .select('vehicle_plate')
        .eq('quote_id', body.quoteId)
        .maybeSingle();
      plate = String(order?.vehicle_plate ?? '')
        .replace(/\s|-/g, '')
        .toUpperCase();
    }

    const quoteCode = String(quote.quote_code || 'COT');
    const rows: AverbaMsRow[] = [];
    const attachments: Array<{ filename: string; content: string }> = [];

    for (const cte of authorized) {
      const ps = (cte.payload_sent ?? {}) as Record<string, unknown>;
      const dest = String(ps.nome_destinatario ?? '');
      rows.push({
        data: formatPtDate(cte.data_autorizacao),
        cte: cte.numero ?? '',
        placa: plate || '—',
        ufOrigem: String(ps.uf_inicio ?? ''),
        ufDestino: String(ps.uf_fim ?? ''),
        valorMercadoria: Number(ps.valor_carga) || 0,
        dest,
      });

      if (!cte.xml_storage_path) {
        return json({ error: `CT-e nº ${cte.numero} sem XML no storage` }, 422, corsHeaders);
      }
      const slash = cte.xml_storage_path.indexOf('/');
      const bucket = cte.xml_storage_path.slice(0, slash);
      const filePath = cte.xml_storage_path.slice(slash + 1);
      const { data: xmlBlob, error: xmlErr } = await adminSb.storage
        .from(bucket)
        .download(filePath);
      if (xmlErr || !xmlBlob) {
        return json(
          { error: `Falha ao baixar XML do CT-e nº ${cte.numero}: ${xmlErr?.message ?? 'vazio'}` },
          502,
          corsHeaders
        );
      }
      const xmlBytes = new Uint8Array(await xmlBlob.arrayBuffer());
      attachments.push({
        filename: filePath.split('/').pop() || `CTe-${cte.numero}.xml`,
        content: bytesToBase64(xmlBytes),
      });
    }

    const csvBytes = buildAverbaMsCsv(rows);
    attachments.push({
      filename: `AVERBACAO-MS-${quoteCode}.csv`,
      content: bytesToBase64(csvBytes),
    });

    const html = buildAverbaMsHtml({ quoteCode, plate: plate || '—', rows });
    const emailPayload = {
      from: resendFrom,
      to,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      subject: `Averbação CT-e ${quoteCode} — Vectra Hub`,
      html,
      attachments,
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      return json({ error: `Resend error: ${resendError}` }, 502, corsHeaders);
    }

    const resendData = (await resendRes.json()) as { id?: string };
    return json(
      {
        success: true,
        emailId: resendData.id,
        cteCount: authorized.length,
        attachmentCount: attachments.length,
      },
      200,
      corsHeaders
    );
  } catch (e) {
    return json({ error: String(e) }, 500, corsHeaders);
  }
});
