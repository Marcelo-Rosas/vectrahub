import { getCorsHeaders } from '../_shared/cors.ts';
import { corsPreflight, resolveSupabaseContext } from '../_shared/supabase-server.ts';

interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  formatted: string;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch {
    return null;
  }
}

async function fetchViaCep(cep: string): Promise<CepData | null> {
  const response = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response?.ok) return null;

  const json = await response.json();
  if (json.erro) return null;

  return {
    cep: json.cep,
    logradouro: json.logradouro || '',
    complemento: json.complemento || '',
    bairro: json.bairro || '',
    localidade: json.localidade,
    uf: json.uf,
    ibge: json.ibge || '',
    formatted: '',
  };
}

async function fetchBrasilApi(cep: string): Promise<CepData | null> {
  const response = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!response?.ok) return null;

  const json = await response.json();
  if (!json.cep) return null;

  return {
    cep: json.cep,
    logradouro: json.street || '',
    complemento: '',
    bairro: json.neighborhood || '',
    localidade: json.city || '',
    uf: json.state || '',
    ibge: '',
    formatted: '',
  };
}

async function fetchOpenCep(cep: string): Promise<CepData | null> {
  const response = await fetchWithTimeout(`https://opencep.com/v1/${cep}.json`);
  if (!response?.ok) return null;

  const json = await response.json();
  if (!json.cep) return null;

  return {
    cep: json.cep,
    logradouro: json.logradouro || '',
    complemento: json.complemento || '',
    bairro: json.bairro || '',
    localidade: json.localidade || '',
    uf: json.uf || '',
    ibge: json.ibge || '',
    formatted: '',
  };
}

function formatAddress(data: CepData): string {
  return [
    data.logradouro,
    data.complemento,
    data.bairro,
    `${data.localidade} - ${data.uf}`,
    data.cep,
  ]
    .filter(Boolean)
    .join(', ');
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsHeaders = getCorsHeaders(req);

  const { error: authCtxError } = await resolveSupabaseContext(req, 'none');
  if (authCtxError) {
    return new Response(JSON.stringify({ success: false, error: authCtxError.message }), {
      status: authCtxError.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    let body: { cep?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo da requisição inválido' }),
        { status: 400, headers: jsonHeaders }
      );
    }
    const { cep } = body;

    const cleanCep = cep?.replace(/\D/g, '');
    if (!cleanCep || cleanCep.length !== 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'CEP inválido. Informe 8 dígitos.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    console.log('[lookup-cep] Buscando CEP:', cleanCep);

    // Fallback triplo: ViaCEP → BrasilAPI v2 → OpenCEP
    let data = await fetchViaCep(cleanCep);

    if (!data) {
      console.log('[lookup-cep] ViaCEP falhou, tentando BrasilAPI v2');
      data = await fetchBrasilApi(cleanCep);
    }

    if (!data) {
      console.log('[lookup-cep] BrasilAPI falhou, tentando OpenCEP');
      data = await fetchOpenCep(cleanCep);
    }

    if (!data) {
      return new Response(JSON.stringify({ success: false, error: 'CEP não encontrado' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    data.formatted = formatAddress(data);
    console.log('[lookup-cep] Sucesso:', data.formatted);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[lookup-cep] Erro:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar CEP' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
