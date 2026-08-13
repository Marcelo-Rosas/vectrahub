import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  consultSefaz,
  mapSefazStatusToValidationStatus,
  type SefazConsultMetadata,
} from '../_shared/sefaz-consult.ts';
import {
  extractNcmFromNfeXml,
  extractNcmFromPdfBytes,
  resolveFocusNfeToken,
  type NfePredominante,
} from '../_shared/nfe-extract.ts';

/**
 * Edge Function: validate-document
 * Valida documentos fiscais (NFe, CTe, MDFe) por:
 * 1. Formato da chave de acesso (44 dígitos)
 * 2. Dígito verificador (mod11)
 * 3. Parsing de XML (quando há arquivo anexado)
 * 4. Extrai metadados da chave (UF, CNPJ emitente, data, modelo, série, número)
 * 5. Consulta SEFAZ (proxy A1 ou Focus NFe) quando consult_sefaz=true e provider configurado
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  status: 'pending' | 'valid' | 'invalid' | 'xml_parsed' | 'sefaz_authorized' | 'sefaz_cancelled';
  document_type: 'nfe' | 'cte' | 'mdfe' | 'unknown';
  validation_errors: string[];
  sefaz?: SefazConsultMetadata | null;
  metadata: {
    uf_code?: string;
    uf_name?: string;
    ano_mes?: string;
    cnpj_emitente?: string;
    modelo?: string;
    modelo_descricao?: string;
    serie?: string;
    numero?: string;
    forma_emissao?: string;
    codigo_numerico?: string;
    digito_verificador?: string;
    dv_calculado?: string;
  };
  xml_data?: {
    chave?: string;
    emitente_cnpj?: string;
    emitente_nome?: string;
    destinatario_cnpj?: string;
    destinatario_nome?: string;
    valor_total?: string;
    data_emissao?: string;
    status?: string;
    ncm?: string;
    produto_predominante?: string;
  };
  nfe_produtos?: NfePredominante | null;
}

// Código IBGE das UFs
const UF_MAP: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

// Modelos de documentos fiscais
const MODELO_MAP: Record<string, string> = {
  '55': 'NF-e',
  '57': 'CT-e',
  '58': 'MDF-e',
  '65': 'NFC-e',
};

/**
 * Calcula o dígito verificador da chave de acesso (mod11)
 */
function calcularDigitoVerificador(chave43: string): string {
  const pesos = [
    4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5,
    4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ];
  let soma = 0;
  for (let i = 0; i < 43; i++) {
    soma += parseInt(chave43[i], 10) * pesos[i];
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv.toString();
}

/**
 * Valida uma chave de acesso de documento fiscal
 */
function validarChaveAcesso(chave: string): ValidationResult {
  const result: ValidationResult = {
    status: 'pending',
    document_type: 'unknown',
    validation_errors: [],
    metadata: {},
  };

  // Remove espaços e caracteres não numéricos
  const chaveLimpa = chave.replace(/\D/g, '');

  if (!chaveLimpa) {
    result.validation_errors.push('Chave de acesso não informada');
    result.status = 'invalid';
    return result;
  }

  if (chaveLimpa.length !== 44) {
    result.validation_errors.push(`Chave deve ter 44 dígitos (tem ${chaveLimpa.length})`);
    result.status = 'invalid';
    return result;
  }

  // Extrai componentes da chave
  const ufCode = chaveLimpa.substring(0, 2);
  const anoMes = chaveLimpa.substring(2, 6);
  const cnpjEmitente = chaveLimpa.substring(6, 20);
  const modelo = chaveLimpa.substring(20, 22);
  const serie = chaveLimpa.substring(22, 26);
  const numero = chaveLimpa.substring(26, 34);
  const formaEmissao = chaveLimpa.substring(34, 35);
  const codigoNumerico = chaveLimpa.substring(35, 43);
  const digitoVerificador = chaveLimpa.substring(43, 44);

  result.metadata = {
    uf_code: ufCode,
    uf_name: UF_MAP[ufCode] || 'Desconhecida',
    ano_mes: `${anoMes.substring(0, 2)}/${anoMes.substring(2, 4)}`,
    cnpj_emitente: `${cnpjEmitente.substring(0, 2)}.${cnpjEmitente.substring(2, 5)}.${cnpjEmitente.substring(5, 8)}/${cnpjEmitente.substring(8, 12)}-${cnpjEmitente.substring(12, 14)}`,
    modelo,
    modelo_descricao: MODELO_MAP[modelo] || 'Desconhecido',
    serie: parseInt(serie, 10).toString(),
    numero: parseInt(numero, 10).toString(),
    forma_emissao: formaEmissao,
    codigo_numerico: codigoNumerico,
    digito_verificador: digitoVerificador,
  };

  // Determina tipo de documento
  if (modelo === '55') result.document_type = 'nfe';
  else if (modelo === '57') result.document_type = 'cte';
  else if (modelo === '58') result.document_type = 'mdfe';
  else if (modelo === '65')
    result.document_type = 'nfe'; // NFC-e
  else {
    result.validation_errors.push(`Modelo ${modelo} não reconhecido (esperado: 55, 57, 58 ou 65)`);
    result.status = 'invalid';
    return result;
  }

  // Valida UF
  if (!UF_MAP[ufCode]) {
    result.validation_errors.push(`Código de UF inválido: ${ufCode}`);
  }

  // Valida ano/mês (não pode ser no futuro, nem muito no passado)
  const ano = parseInt(`20${anoMes.substring(0, 2)}`, 10);
  const mes = parseInt(anoMes.substring(2, 4), 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (ano < 2005 || ano > currentYear + 1) {
    result.validation_errors.push(`Ano ${ano} fora do intervalo válido`);
  }
  if (mes < 1 || mes > 12) {
    result.validation_errors.push(`Mês ${mes} inválido`);
  }
  if (ano === currentYear && mes > currentMonth + 1) {
    result.validation_errors.push(`Data de emissão no futuro`);
  }

  // Valida dígito verificador
  const dvCalculado = calcularDigitoVerificador(chaveLimpa.substring(0, 43));
  result.metadata.dv_calculado = dvCalculado;

  if (digitoVerificador !== dvCalculado) {
    result.validation_errors.push(
      `Dígito verificador inválido (informado: ${digitoVerificador}, calculado: ${dvCalculado})`
    );
    result.status = 'invalid';
    return result;
  }

  // Se chegou aqui, a chave é válida estruturalmente
  if (result.validation_errors.length === 0) {
    result.status = 'valid';
  } else {
    result.status = 'invalid';
  }

  return result;
}

/**
 * Faz parsing básico de XML de CT-e, NF-e ou MDF-e
 */
function parseXml(xmlContent: string): ValidationResult['xml_data'] {
  const data: ValidationResult['xml_data'] = {};

  try {
    // Extrai chave de acesso do XML (infCTe, infNFe, infMDFe)
    const chaveMatch =
      xmlContent.match(/<infCTe[^>]*Id="(CTe\d{44})"/i) ||
      xmlContent.match(/<infNFe[^>]*Id="(NFe\d{44})"/i) ||
      xmlContent.match(/<infMDFe[^>]*Id="(MDFe\d{44})"/i);
    if (chaveMatch) {
      data.chave = chaveMatch[1].replace(/^(CTe|NFe|MDFe)/, '');
    }

    // Extrai emitente
    const emitCnpjMatch =
      xmlContent.match(/<emit>.*?<CNPJ>(\d+)<\/CNPJ>.*?<\/emit>/s) ||
      xmlContent.match(/<emit>.*?<Cnpj>(\d+)<\/Cnpj>.*?<\/emit>/s);
    if (emitCnpjMatch) data.emitente_cnpj = emitCnpjMatch[1];

    const emitNomeMatch = xmlContent.match(/<emit>.*?<xNome>([^<]+)<\/xNome>.*?<\/emit>/s);
    if (emitNomeMatch) data.emitente_nome = emitNomeMatch[1];

    // Extrai destinatário
    const destCnpjMatch =
      xmlContent.match(/<dest>.*?<CNPJ>(\d+)<\/CNPJ>.*?<\/dest>/s) ||
      xmlContent.match(/<dest>.*?<Cnpj>(\d+)<\/Cnpj>.*?<\/dest>/s);
    if (destCnpjMatch) data.destinatario_cnpj = destCnpjMatch[1];

    const destNomeMatch = xmlContent.match(/<dest>.*?<xNome>([^<]+)<\/xNome>.*?<\/dest>/s);
    if (destNomeMatch) data.destinatario_nome = destNomeMatch[1];

    // Valor total
    const vTotalMatch =
      xmlContent.match(/<vNF>([\d.]+)<\/vNF>/i) ||
      xmlContent.match(/<vTPrest>.*?<vTPrest>([\d.]+)<\/vTPrest>/i) ||
      xmlContent.match(/<vTotTrib>([\d.]+)<\/vTotTrib>/i);
    if (vTotalMatch) data.valor_total = vTotalMatch[1];

    // Data de emissão
    const dhEmiMatch =
      xmlContent.match(/<dhEmi>([^<]+)<\/dhEmi>/i) || xmlContent.match(/<dhEmi>([^<]+)<\/dhEmi>/i);
    if (dhEmiMatch) data.data_emissao = dhEmiMatch[1];

    // Status (cStat na consulta, ou apenas infProt)
    const cStatMatch = xmlContent.match(/<cStat>(\d+)<\/cStat>/);
    if (cStatMatch) {
      const cStat = cStatMatch[1];
      if (cStat === '100') data.status = 'autorizado';
      else if (cStat === '101') data.status = 'cancelado';
      else if (cStat === '110') data.status = 'denegado';
      else data.status = `status_${cStat}`;
    }

    const pred = extractNcmFromNfeXml(xmlContent);
    if (pred) {
      data.ncm = pred.ncm;
      data.produto_predominante = pred.descricao;
    }
  } catch (e) {
    // Silenciosamente ignora erros de parsing
  }

  return data;
}

/** Extrai chave de 44 dígitos embutida em DANFE/DACTE PDF (texto no stream). */
function extractChaveFromPdfBytes(bytes: Uint8Array): string | null {
  const raw = new TextDecoder('latin1').decode(bytes);
  const candidates = new Set<string>();

  const compact = raw.replace(/\s/g, '');
  const re44 = /\d{44}/g;
  let match: RegExpExecArray | null;
  while ((match = re44.exec(compact)) !== null) {
    candidates.add(match[0]);
  }

  const spaced = raw.match(/(?:\d{4}\s){10}\d{1,4}/);
  if (spaced) {
    const clean = spaced[0].replace(/\s/g, '');
    if (clean.length === 44) candidates.add(clean);
  }

  for (const candidate of candidates) {
    const check = validarChaveAcesso(candidate);
    if (check.status === 'valid') return candidate;
  }

  return null;
}

function isPdfPath(path: string, fileName?: string | null): boolean {
  const lower = `${path} ${fileName ?? ''}`.toLowerCase();
  return lower.includes('.pdf');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));

    const { documentId, nfe_key, xml_content, auto_update = true, consult_sefaz = true } = body;

    if (!documentId && !nfe_key) {
      return new Response(JSON.stringify({ error: 'Informe documentId ou nfe_key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca o documento se documentId foi informado
    let documento: any = null;
    let chaveParaValidar = nfe_key;
    let xmlParaParse: string | null = xml_content || null;
    let pdfBytes: Uint8Array | null = null;
    let nfePredominante: NfePredominante | null = null;

    if (documentId) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, nfe_key, type, file_url, file_name, order_id')
        .eq('id', documentId)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Documento não encontrado', details: error }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      documento = data;
      chaveParaValidar = chaveParaValidar || data.nfe_key;

      // file_url = path no bucket (ex.: userId/timestamp-random.xml), não URL pública
      const storagePath = data.file_url?.trim() ?? '';

      // Se tem arquivo e ainda não tem XML parseado, tenta baixar
      if (storagePath && !xmlParaParse) {
        try {
          const { data: fileData, error: fileError } = await supabase.storage
            .from('documents')
            .download(storagePath);

          if (!fileError && fileData) {
            const bytes = new Uint8Array(await fileData.arrayBuffer());
            const head = new TextDecoder('utf-8').decode(bytes.slice(0, 512)).trim();
            if (head.startsWith('<?xml') || head.startsWith('<')) {
              xmlParaParse = new TextDecoder('utf-8').decode(bytes);
            } else if (isPdfPath(storagePath, data.file_name)) {
              pdfBytes = bytes;
              if (!chaveParaValidar) {
                const fromPdf = extractChaveFromPdfBytes(bytes);
                if (fromPdf) chaveParaValidar = fromPdf;
              }
            }
          }
        } catch (e) {
          // Ignora erro de download
        }
      }
    }

    // Valida a chave de acesso
    let result: ValidationResult;

    if (chaveParaValidar) {
      result = validarChaveAcesso(chaveParaValidar);
    } else if (xmlParaParse) {
      // Tenta extrair chave do XML
      const xmlData = parseXml(xmlParaParse);
      if (xmlData.chave) {
        result = validarChaveAcesso(xmlData.chave);
      } else {
        result = {
          status: 'pending',
          document_type: 'unknown',
          validation_errors: ['Não foi possível extrair chave de acesso do XML'],
          metadata: {},
        };
      }
    } else {
      const isPdf =
        documento?.file_name?.toLowerCase().endsWith('.pdf') ||
        documento?.file_url?.toLowerCase().includes('.pdf');
      result = {
        status: 'pending',
        document_type: 'unknown',
        validation_errors: [
          isPdf
            ? 'PDF sem chave legível. Cole a chave de 44 dígitos da DANFE ou envie o XML.'
            : 'Chave de acesso não informada e XML não disponível',
        ],
        metadata: {},
      };
    }

    // Faz parsing do XML se disponível (+ NCM produto predominante)
    if (xmlParaParse) {
      result.xml_data = parseXml(xmlParaParse);
      nfePredominante = extractNcmFromNfeXml(xmlParaParse);
      if (result.status === 'valid' && result.xml_data?.chave) {
        result.status = 'xml_parsed';
      }
    } else if (pdfBytes) {
      nfePredominante = extractNcmFromPdfBytes(pdfBytes);
    }

    if (nfePredominante) {
      result.nfe_produtos = nfePredominante;
      result.metadata = {
        ...result.metadata,
        ncm: nfePredominante.ncm,
        produto_predominante: nfePredominante.descricao,
        ncm_itens: nfePredominante.itens.length,
      };
      if (result.xml_data) {
        result.xml_data.ncm = nfePredominante.ncm;
        result.xml_data.produto_predominante = nfePredominante.descricao;
      }
    }

    const chaveFinal =
      chaveParaValidar?.replace(/\D/g, '') || result.xml_data?.chave?.replace(/\D/g, '') || '';

    const podeConsultarSefaz =
      consult_sefaz &&
      chaveFinal.length === 44 &&
      (result.status === 'valid' || result.status === 'xml_parsed');

    if (podeConsultarSefaz) {
      const focusToken = resolveFocusNfeToken();
      const sefazResult = await consultSefaz(chaveFinal, {
        proxyUrl: Deno.env.get('SEFAZ_PROXY_URL'),
        proxySecret: Deno.env.get('SEFAZ_PROXY_SECRET'),
        focusToken,
        vectraCnpj: Deno.env.get('VECTRA_CNPJ') ?? '59650913000104',
      });

      if (sefazResult.metadata) {
        result.sefaz = sefazResult.metadata;
        result.metadata = {
          ...result.metadata,
          sefaz: sefazResult.metadata,
        };
        result.status = mapSefazStatusToValidationStatus(sefazResult.metadata.c_stat);

        if (result.status === 'sefaz_authorized') {
          result.validation_errors = [];
        } else if (result.status === 'sefaz_cancelled') {
          result.validation_errors = [
            sefazResult.metadata.x_motivo || 'Documento cancelado na SEFAZ',
          ];
        } else if (result.status === 'invalid') {
          result.validation_errors = [
            sefazResult.metadata.x_motivo || 'Documento rejeitado ou inválido na SEFAZ',
          ];
        } else if (result.status === 'pending') {
          result.validation_errors = [
            sefazResult.metadata.x_motivo || 'Documento não localizado na base SEFAZ',
          ];
        }
      } else if (sefazResult.error) {
        result.sefaz = null;
        // Proxy 530 = origem do proxy inacessível (Cloudflare). Chave local ainda válida.
        const hint =
          sefazResult.http_status === 530
            ? ' (proxy SEFAZ offline — chave ok local; Focus fallback indisponível ou NF-e não na distribuição)'
            : '';
        result.validation_errors = [
          ...result.validation_errors,
          `SEFAZ: ${sefazResult.error}${hint}`,
        ];
      }
    }

    // Atualiza o documento no banco
    if (auto_update && documentId) {
      const updateData: any = {
        validation_status: result.status,
        validation_errors: result.validation_errors.length > 0 ? result.validation_errors : null,
        validation_metadata: result.metadata,
      };

      const chaveLimpa = chaveParaValidar?.replace(/\D/g, '') ?? '';
      if (
        chaveLimpa.length === 44 &&
        (result.status === 'valid' ||
          result.status === 'xml_parsed' ||
          result.status === 'sefaz_authorized' ||
          result.status === 'sefaz_cancelled')
      ) {
        updateData.nfe_key = chaveLimpa;
      } else if (result.xml_data?.chave && !documento?.nfe_key) {
        updateData.nfe_key = result.xml_data.chave;
      }

      await supabase.from('documents').update(updateData).eq('id', documentId);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na validação:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno na validação',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
