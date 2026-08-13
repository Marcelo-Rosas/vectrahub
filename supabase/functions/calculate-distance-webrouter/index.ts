import { getCorsHeaders } from '../_shared/cors.ts';

type WaypointInput = { cep: string; city_uf?: string; label?: string };

type Input = {
  origin_cep: string;
  destination_cep: string;
  /** Paradas intermediárias (ordem: entre origem e destino). CEP obrigatório. */
  waypoints?: WaypointInput[];
  /** UF origem (2 letras). Usado no fallback geográfico 50/50 quando km_by_uf não é extraído. */
  origin_uf?: string;
  /** UF destino (2 letras). Usado no fallback geográfico 50/50 quando km_by_uf não é extraído. */
  destination_uf?: string;
  axes_count?: number;
  /** Categoria AILOG/WebRouter (ex: "2","4","6","7","8","12"). Preferida sobre axes_count. */
  categoria_veiculo?: string;
};

interface TollPlaza {
  nome: string;
  cidade: string;
  uf: string;
  valor: number;
  valorTag: number;
  ordemPassagem: number;
}

function sanitizeCep(v: string) {
  return (v || '').toString().replace(/\D/g, '').slice(0, 8);
}

function getEnv(key: string): string | undefined {
  try {
    if (
      typeof (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno
        ?.env?.get === 'function'
    ) {
      return (
        globalThis as { Deno: { env: { get: (k: string) => string | undefined } } }
      ).Deno.env.get(key);
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Map axes_count (number of axles) to WebRouter categoriaVeiculo code.
 * See WebRouter API docs — Tabela de Categorias:
 *   "2" = Comercial 2 eixos, "4" = Comercial 3 eixos,
 *   "6" = Comercial 4 eixos, "7" = Comercial 5 eixos,
 *   "8" = Comercial 6 eixos, "10" = Comercial 7 eixos,
 *   "11" = Comercial 8 eixos, "12" = Comercial 9 eixos.
 * Default: "6" (4 eixos — caminhão trucado, perfil mais comum).
 */
function axesToCategoria(axes?: number): string {
  if (!axes || axes < 2) return '6'; // default: trucado 4 eixos
  const map: Record<number, string> = {
    2: '2',
    3: '4',
    4: '6',
    5: '7',
    6: '8',
    7: '10',
    8: '11',
    9: '12',
  };
  return map[axes] ?? '8'; // 6+ eixos fallback to comercial 6 eixos
}

const WEBROUTER_URL = 'https://way.webrouter.com.br/RouterService/router/api/calcular';

const UA = 'vectra-cargo-flow/1.0 (webrouter; contact: support@vectracargo.com.br)';

async function fetchAddressFromCep(
  cep: string
): Promise<{ localidade: string; uf: string } | null> {
  const sources = [
    {
      url: `https://viacep.com.br/ws/${cep}/json/`,
      get: (j: { erro?: unknown; localidade?: string; uf?: string }) =>
        !j.erro && j.localidade && j.uf ? { localidade: j.localidade, uf: j.uf } : null,
    },
    {
      url: `https://brasilapi.com.br/api/cep/v2/${cep}`,
      get: (j: { city?: string; state?: string }) =>
        j.city && j.state ? { localidade: j.city, uf: j.state } : null,
    },
    {
      url: `https://opencep.com/v1/${cep}.json`,
      get: (j: { localidade?: string; uf?: string }) =>
        j.localidade && j.uf ? { localidade: j.localidade, uf: j.uf } : null,
    },
  ];
  for (const s of sources) {
    try {
      const res = await fetch(s.url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (res.ok) {
        const j = await res.json();
        const addr = s.get(j);
        if (addr) return addr;
      }
    } catch {
      // continue
    }
  }
  return null;
}

function buildAddress(cep: string, ordemPassagem: number, opts?: { cidade?: string; uf?: string }) {
  const uf = (opts?.uf || '').trim().toUpperCase().slice(0, 2);
  const cidade = (opts?.cidade || '').trim().slice(0, 100);
  return {
    ordemPassagem,
    codigo: '',
    logradouro: '',
    numero: '',
    cep,
    cidade: { pais: 'Brasil', uf, cidade, codigoIbge: 0 },
    latLng: { latitude: 0, longitude: 0 },
  };
}

const ERROR_MAP: Record<string, { status: number; message: string }> = {
  LICENCA_INVALIDA: { status: 403, message: 'Chave de acesso inválida' },
  API_NAO_AUTORIZADA: { status: 403, message: 'API não autorizada' },
  LIMITE_CONSUMO_ATINGIDO: { status: 429, message: 'Limite de consumo atingido' },
  ERRO_CALCULO_ROTEIRO: { status: 422, message: 'Erro ao calcular rota' },
};

function normalizeUf(v: string | undefined): string | undefined {
  const s = (v || '').toString().trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : undefined;
}

/** "Vitoria da Conquista - BA" → { cidade, uf: "BA" }. Não usar slice(0,2) ("VI"). */
function parseCityUf(cityUf?: string): { cidade?: string; uf?: string } | undefined {
  const s = (cityUf || '').trim();
  if (!s) return undefined;
  const m = s.match(/^(.*?)[\s,/\-]*([A-Za-z]{2})$/);
  if (m && /^[A-Z]{2}$/i.test(m[2])) {
    const cidade = m[1].replace(/[\s,\-]+$/g, '').trim();
    return { cidade: cidade || undefined, uf: m[2].toUpperCase() };
  }
  if (/^[A-Z]{2}$/i.test(s)) return { uf: s.toUpperCase() };
  return { cidade: s };
}

/**
 * Extract km per UF from WebRouter response.
 * Priority: 1) ordemRoteiro, 2) pathSegments/resumoEstados, 3) tollPlazas, 4) geographic 50/50.
 */
function extractKmByUf(
  rota: Record<string, unknown>,
  totalKm: number,
  tollPlazas: TollPlaza[],
  opts?: { originUf?: string; destinationUf?: string }
): Record<string, number> | undefined {
  const acc: Record<string, number> = {};

  // 1. Try ordemRoteiro (array of points with cidade.uf and distanciaAcumulada or similar)
  const ordemRoteiro = rota?.ordemRoteiro;
  if (Array.isArray(ordemRoteiro) && ordemRoteiro.length >= 2) {
    for (let i = 1; i < ordemRoteiro.length; i++) {
      const curr = ordemRoteiro[i] as {
        uf?: string;
        cidade?: { uf?: string };
        distancia?: number;
        distanciaAcumulada?: number;
      };
      const prev = ordemRoteiro[i - 1] as { distancia?: number; distanciaAcumulada?: number };
      const uf = (curr?.cidade as { uf?: string } | undefined)?.uf ?? curr?.uf ?? '';
      const prevDist = prev?.distanciaAcumulada ?? prev?.distancia ?? 0;
      const currDist = curr?.distanciaAcumulada ?? curr?.distancia ?? prevDist;
      const delta = Math.max(0, currDist - prevDist);
      if (uf && delta > 0) acc[uf] = (acc[uf] ?? 0) + delta;
    }
    if (Object.keys(acc).length > 0) return acc;
  }

  // 2. Try path.pathSegments or resumoEstados (if API returns km per state directly)
  const pathSegments = (rota?.path as Record<string, unknown> | undefined)?.pathSegments;
  if (Array.isArray(pathSegments)) {
    for (const seg of pathSegments) {
      const s = seg as { uf?: string; km?: number; distancia?: number };
      const uf = s?.uf ?? '';
      const kmVal = s?.km ?? s?.distancia ?? 0;
      if (uf && kmVal > 0) acc[uf] = (acc[uf] ?? 0) + kmVal;
    }
    if (Object.keys(acc).length > 0) return acc;
  }
  const resumoEstados = rota?.resumoEstados as Record<string, number> | undefined;
  if (resumoEstados && typeof resumoEstados === 'object') {
    for (const [uf, kmVal] of Object.entries(resumoEstados)) {
      const k = Number(kmVal);
      if (uf && Number.isFinite(k) && k > 0) acc[uf] = (acc[uf] ?? 0) + k;
    }
    if (Object.keys(acc).length > 0) return acc;
  }

  // 3. Fallback: distribute totalKm across toll plaza segments
  if (tollPlazas.length > 0 && totalKm > 0) {
    const sorted = [...tollPlazas].sort((a, b) => a.ordemPassagem - b.ordemPassagem);
    const segmentKm = totalKm / (sorted.length + 1);
    for (let i = 0; i < sorted.length; i++) {
      const uf = sorted[i].uf || 'XX';
      acc[uf] = (acc[uf] ?? 0) + segmentKm;
    }
    const lastUf = sorted[sorted.length - 1]?.uf || 'XX';
    acc[lastUf] = (acc[lastUf] ?? 0) + segmentKm;
    return acc;
  }

  // 4. Geographic fallback: 50% origin UF, 50% destination UF (tributariamente mais seguro)
  const originUf = normalizeUf(opts?.originUf);
  const destinationUf = normalizeUf(opts?.destinationUf);
  if (totalKm > 0 && originUf && destinationUf) {
    const halfKm = totalKm / 2;
    if (originUf === destinationUf) {
      return { [originUf]: totalKm };
    }
    return { [originUf]: halfKm, [destinationUf]: halfKm };
  }

  return undefined;
}

/**
 * Extract toll plazas from WebRouter response.
 * WebRouter returns: rotas[0].informacaoPedagios.result.pedagios[]
 * Each plaza has: nome, cidade { uf, cidade }, valor, valorTag, ordemPassagem
 */
function extractTollPlazas(rota: Record<string, unknown>): TollPlaza[] {
  try {
    const info = rota?.informacaoPedagios as Record<string, unknown> | undefined;
    const result = info?.result as Record<string, unknown> | undefined;
    const pedagios = result?.pedagios;
    if (!Array.isArray(pedagios)) return [];

    return pedagios.map((p: Record<string, unknown>) => {
      const cidade = p.cidade as Record<string, unknown> | undefined;
      return {
        nome: String(p.nome || ''),
        cidade: String(cidade?.cidade || ''),
        uf: String(cidade?.uf || ''),
        valor: Number(p.valor) || 0,
        valorTag: Number(p.valorTag) || 0,
        ordemPassagem: Number(p.ordemPassagem) || 0,
      };
    });
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<Input>;
    const originCep = sanitizeCep(body.origin_cep || '');
    const destinationCep = sanitizeCep(body.destination_cep || '');
    const waypointsRaw = Array.isArray(body.waypoints)
      ? (body.waypoints as WaypointInput[]).filter((w) => w && typeof w === 'object')
      : [];
    const waypoints = waypointsRaw
      .map((w) => ({ cep: sanitizeCep(w.cep || ''), city_uf: w.city_uf, label: w.label }))
      .filter((w) => w.cep.length === 8);

    if (originCep.length !== 8 || destinationCep.length !== 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'CEPs de origem e destino inválidos' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const apiKey = getEnv('WEBROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'WEBROUTER_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const axesCount = body.axes_count;
    const categoriaVeiculo = body.categoria_veiculo;
    const categoria =
      categoriaVeiculo && /^\d+$/.test(String(categoriaVeiculo))
        ? String(categoriaVeiculo)
        : axesToCategoria(axesCount);

    // Buscar origem, paradas e destino (cidade, UF) via CEP para enriquecer o payload WebRouter
    const originUfInput = normalizeUf(body.origin_uf);
    const destinationUfInput = normalizeUf(body.destination_uf);
    const cepsToFetch = [originCep, ...waypoints.map((w) => w.cep), destinationCep];
    const addrs = await Promise.all(cepsToFetch.map((cep) => fetchAddressFromCep(cep)));
    const originAddrFinal = addrs[0]
      ? { cidade: addrs[0].localidade, uf: addrs[0].uf }
      : originUfInput
        ? { cidade: '', uf: originUfInput }
        : undefined;
    const destinationAddrFinal = addrs[addrs.length - 1]
      ? { cidade: addrs[addrs.length - 1].localidade, uf: addrs[addrs.length - 1].uf }
      : destinationUfInput
        ? { cidade: '', uf: destinationUfInput }
        : undefined;

    const enderecos: ReturnType<typeof buildAddress>[] = [
      buildAddress(originCep, 1, originAddrFinal),
    ];
    waypoints.forEach((wp, i) => {
      const addr = addrs[i + 1];
      const parsed = parseCityUf(wp.city_uf);
      const opts = addr
        ? { cidade: addr.localidade, uf: addr.uf }
        : parsed
          ? { cidade: parsed.cidade || '', uf: parsed.uf || '' }
          : undefined;
      enderecos.push(buildAddress(wp.cep, i + 2, opts));
    });
    enderecos.push(
      buildAddress(
        destinationCep,
        enderecos.length + 1,
        destinationAddrFinal || parseCityUf(body.destination_uf)
      )
    );

    const webRouterBody = {
      autenticacao: { chaveAcesso: apiKey },
      rota: {
        enderecos,
        params: {
          categoriaVeiculo: categoria,
          perfilVeiculo: 'CAMINHAO',
          tipoCombustivel: 'DIESEL',
          tipoVeiculo: 'CAMINHAO',
          tipoCaminho: 'RAPIDA',
          priorizarRodovias: true,
          retornaURLmapa: true,
        },
      },
      salvarRota: false,
    };

    console.log(
      `[webrouter] Route calculation: ${originCep} → ${destinationCep}, categoria: ${categoria}`
    );

    const res = await fetch(WEBROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(webRouterBody),
    });

    const data = await res.json().catch(() => ({}));

    const wrStatus = data?.status ?? data?.codigo ?? '';
    const wrMsg = data?.mensagem ?? data?.message ?? '';

    if (!res.ok) {
      const err = ERROR_MAP[wrStatus] || {
        status: res.status,
        message: wrMsg || 'Erro ao consultar WebRouter',
      };
      const detail =
        wrStatus || wrMsg ? ` (WebRouter: ${[wrStatus, wrMsg].filter(Boolean).join(' - ')})` : '';
      return new Response(JSON.stringify({ success: false, error: err.message + detail }), {
        status: err.status >= 400 ? err.status : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (wrStatus !== 'SUCESSO' && wrStatus !== '') {
      const err = ERROR_MAP[wrStatus] || {
        status: 422,
        message: wrMsg || 'Erro ao calcular rota',
      };
      const detail =
        wrStatus || wrMsg ? ` (WebRouter: ${[wrStatus, wrMsg].filter(Boolean).join(' - ')})` : '';
      return new Response(JSON.stringify({ success: false, error: err.message + detail }), {
        status: err.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rotas = data?.rotas;
    const rota = Array.isArray(rotas) ? rotas[0] : null;

    // Logs detalhados da resposta WebRouter (estrutura para depuração)
    if (rota && typeof rota === 'object') {
      const rotaKeys = Object.keys(rota as Record<string, unknown>);
      const ordemRoteiro = (rota as Record<string, unknown>).ordemRoteiro;
      if (Array.isArray(ordemRoteiro)) {
        console.log(
          `[webrouter] ordemRoteiro length: ${ordemRoteiro.length}, sample[0]: ${JSON.stringify(ordemRoteiro[0])}`
        );
      } else {
        console.log(
          `[webrouter] ordemRoteiro: ${ordemRoteiro === undefined ? 'undefined' : typeof ordemRoteiro}`
        );
      }
      const path = (rota as Record<string, unknown>).path;
      if (path && typeof path === 'object') {
        const pathKeys = Object.keys(path as Record<string, unknown>);
      }
      const resumoEstados = (rota as Record<string, unknown>).resumoEstados;
      if (resumoEstados != null) {
        console.log(`[webrouter] resumoEstados: ${JSON.stringify(resumoEstados)}`);
      }
    }

    const distanciaKM = rota?.path?.distanciaKM;
    const km = typeof distanciaKM === 'number' ? distanciaKM : null;

    if (km == null || !Number.isFinite(km) || km < 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'WebRouter não retornou distância válida' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const custos = rota?.custos ?? {};
    const tollPlazas = rota ? extractTollPlazas(rota as Record<string, unknown>) : [];
    const kmByUf = extractKmByUf((rota as Record<string, unknown>) ?? {}, km, tollPlazas, {
      originUf: originUfInput ?? undefined,
      destinationUf: destinationUfInput ?? undefined,
    });

    const kmByUfSource = kmByUf
      ? Object.keys(kmByUf).length > 0
        ? Object.entries(kmByUf)
            .map(([uf, k]) => `${uf}:${Math.round(k)}`)
            .join(', ')
        : 'empty'
      : 'n/a';
    console.log(
      `[webrouter] Resultado: ${km} km, pedágio: ${custos.pedagio}, tag: ${custos.pedagioTag}, praças: ${tollPlazas.length}, km_by_uf: ${kmByUfSource}`
    );

    const consolidatedKmByUf = kmByUf && Object.keys(kmByUf).length > 0 ? kmByUf : undefined;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          km_distance: Math.round(km * 10) / 10,
          toll: custos.pedagio ?? undefined,
          toll_tag: custos.pedagioTag ?? undefined,
          toll_plazas: tollPlazas,
          km_by_uf: consolidatedKmByUf,
          source: 'webrouter',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
