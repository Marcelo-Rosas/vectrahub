import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { extractDestFromNfeXml } from '@/lib/nfe-dest-from-meta';

function digits(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

export function isNfeAuthorizedXml(xml: string): boolean {
  return /<(?:\w+:)?infNFe\b/i.test(xml) || /<(?:\w+:)?NFe\b/i.test(xml);
}

export function nfeKeyFromXml(xml: string): string | null {
  const destChave =
    xml.match(/<(?:\w+:)?infNFe[^>]*Id="NFe(\d{44})"/i)?.[1] ??
    xml.match(/<(?:\w+:)?chNFe>(\d{44})<\/(?:\w+:)?chNFe>/i)?.[1];
  const k = digits(destChave);
  return k.length === 44 ? k : null;
}

export async function mergeQuoteNfeKeys(quoteId: string, keys: string[]): Promise<void> {
  const clean = [...new Set(keys.map(digits).filter((k) => k.length === 44))];
  if (!clean.length) return;
  const { data, error } = await supabase
    .from('quotes')
    .select('nfe_keys')
    .eq('id', quoteId)
    .single();
  if (error) throw error;
  const prev = Array.isArray(data?.nfe_keys) ? data.nfe_keys.map(digits) : [];
  const next = [...new Set([...prev, ...clean])];
  const { error: upErr } = await supabase
    .from('quotes')
    .update({ nfe_keys: next })
    .eq('id', quoteId);
  if (upErr) throw upErr;
}

type ValidateDocResult = {
  xml_data?: { chave?: string; destinatario_nome?: string };
  metadata?: { destinatario_nome?: string };
};

export async function attachNfeXmlFiles(opts: {
  userId: string;
  files: File[];
  quoteId?: string | null;
  orderId?: string | null;
}): Promise<{ keys: string[]; destNames: string[] }> {
  const keys: string[] = [];
  const destNames: string[] = [];
  if (!opts.quoteId && !opts.orderId) {
    throw new Error('Cotação ou OS necessária para anexar XML da NF-e');
  }

  for (const file of opts.files) {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      throw new Error(`${file.name}: só XML autorizado da NF-e (não DANFE PDF)`);
    }
    const xml = await file.text();
    if (!isNfeAuthorizedXml(xml)) {
      throw new Error(`${file.name}: arquivo não parece NF-e (infNFe)`);
    }
    const fromFile = nfeKeyFromXml(xml);
    const dest = extractDestFromNfeXml(xml);
    if (dest.destinatario_nome) destNames.push(dest.destinatario_nome);

    const fileExt = 'xml';
    const fileName = `${opts.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/xml',
      });
    if (uploadError) throw uploadError;

    const { data: created, error: insErr } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        file_url: uploadData.path,
        file_size: file.size,
        type: 'nfe',
        order_id: opts.orderId || null,
        quote_id: opts.quoteId || null,
        uploaded_by: opts.userId,
        nfe_key: fromFile,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const validated = await invokeEdgeFunction<ValidateDocResult>('validate-document', {
      body: { documentId: created.id, auto_update: true, consult_sefaz: false },
    });
    const chave = digits(validated.xml_data?.chave ?? fromFile);
    if (chave.length === 44) keys.push(chave);
    const nome = String(
      validated.metadata?.destinatario_nome ??
        validated.xml_data?.destinatario_nome ??
        dest.destinatario_nome ??
        ''
    ).trim();
    if (nome && !destNames.includes(nome)) destNames.push(nome);
  }

  if (opts.quoteId && keys.length) await mergeQuoteNfeKeys(opts.quoteId, keys);
  return { keys, destNames };
}
