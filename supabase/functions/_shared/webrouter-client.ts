/**
 * Shared WebRouter client — callable from any Edge Function.
 * Calculates route distance (km), tolls, and polyline for origin → waypoints → destination
 * using the WebRouter API (AILOG Roteirizador REST v2.0).
 *
 * categoriaVeiculo mapping (commercial, rod. dupla):
 *   axes 2→'2', 3→'4', 4→'6', 5→'7', 6→'8', 7→'10', 8→'11', 9→'12'
 */

/** Map axes_count → WebRouter categoriaVeiculo (commercial, rod. dupla) */
export function axesToCategoriaVeiculo(axesCount?: number): string {
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
  return map[axesCount ?? 4] ?? '6'; // default: 4 eixos comercial
}

const WEBROUTER_URL = 'https://way.webrouter.com.br/RouterService/router/api/calcular';
const UA = 'vectra-cargo-flow/1.0 (webrouter; contact: support@vectracargo.com.br)';

function getEnv(key: string): string | undefined {
  try {
    const deno = globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } };
    if (typeof deno.Deno?.env?.get === 'function') return deno.Deno.env.get(key);
  } catch {
    // ignore
  }
  return undefined;
}

function sanitizeCep(v: string): string {
  return (v || '').toString().replace(/\D/g, '').slice(0, 8);
}

async function fetchCityUf(cep: string): Promise<{ cidade: string; uf: string } | null> {
  const sources = [
    {
      url: `https://viacep.com.br/ws/${cep}/json/`,
      get: (j: { erro?: unknown; localidade?: string; uf?: string }) =>
        !j.erro && j.localidade && j.uf ? { cidade: j.localidade, uf: j.uf } : null,
    },
    {
      url: `https://brasilapi.com.br/api/cep/v2/${cep}`,
      get: (j: { city?: string; state?: string }) =>
        j.city && j.state ? { cidade: j.city, uf: j.state } : null,
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
  return {
    ordemPassagem, // 1-based (caller must pass i+1)
    codigo: String(ordemPassagem).padStart(2, '0'),
    logradouro: '',
    numero: '',
    cep,
    cidade: {
      pais: 'Brasil',
      uf: (opts?.uf || '').trim().toUpperCase().slice(0, 2),
      cidade: (opts?.cidade || '').trim().slice(0, 100),
      codigoIbge: '',
    },
    latLng: { latitude: 0, longitude: 0 },
    informacaoParada: {
      peso: 0,
      volume: 0,
      descricao: '',
      dias: 0,
      horas: 0,
      minutos: 0,
    },
  };
}

export interface RouteDistanceResult {
  km_distance: number;
  success: true;
}

export interface RouteDistanceError {
  success: false;
  error: string;
}

/**
 * Calculate route distance via WebRouter API.
 *
 * @param originCep      Origin CEP (8 digits)
 * @param destinationCep Destination CEP (8 digits)
 * @param waypointCeps   Intermediate stop CEPs (ordered)
 * @returns km_distance or error
 */
export async function calculateRouteDistance(
  originCep: string,
  destinationCep: string,
  waypointCeps: string[] = [],
  axesCount?: number
): Promise<RouteDistanceResult | RouteDistanceError> {
  const apiKey = getEnv('WEBROUTER_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'WEBROUTER_API_KEY not configured' };
  }

  const origin = sanitizeCep(originCep);
  const destination = sanitizeCep(destinationCep);
  const waypoints = waypointCeps.map(sanitizeCep).filter((c) => c.length === 8);

  if (origin.length !== 8 || destination.length !== 8) {
    return { success: false, error: 'Invalid origin or destination CEP' };
  }

  // Geocode all CEPs in parallel for city/uf enrichment
  const allCeps = [origin, ...waypoints, destination];
  const addrs = await Promise.all(allCeps.map(fetchCityUf));

  const enderecos = allCeps.map((cep, i) => {
    const addr = addrs[i];
    return buildAddress(cep, i + 1, addr ?? undefined);
  });

  const body = {
    autenticacao: { chaveAcesso: apiKey },
    rota: {
      enderecos,
      params: {
        categoriaVeiculo: axesToCategoriaVeiculo(axesCount),
        perfilVeiculo: 'CAMINHAO',
        tipoCombustivel: 'DIESEL',
        tipoVeiculo: 'CAMINHAO',
        tipoCaminho: 'RAPIDA',
        priorizarRodovias: true,
        retornaURLmapa: true,
      },
    },
    salvarRota: true,
  };

  try {
    const res = await fetch(WEBROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false, error: data?.mensagem || `WebRouter HTTP ${res.status}` };
    }

    const status = data?.status ?? '';
    if (status !== 'SUCESSO' && status !== '') {
      return { success: false, error: data?.mensagem || `WebRouter status: ${status}` };
    }

    const rota = Array.isArray(data?.rotas) ? data.rotas[0] : null;
    const km = rota?.path?.distanciaKM;

    if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) {
      return { success: false, error: 'WebRouter did not return valid distance' };
    }

    return { success: true, km_distance: Math.round(km * 10) / 10 };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'WebRouter fetch failed' };
  }
}

// ---------------------------------------------------------------------------
// Full route result (with toll + coordinates for map rendering)
// ---------------------------------------------------------------------------

export interface TollPlaza {
  nome: string;
  cidade: string;
  uf: string;
  /** Valor praça em R$ (WebRouter). */
  valor: number;
  /** Valor TAG em R$ (WebRouter). */
  valorTag: number;
  ordemPassagem: number;
  /** Código da praça AILOG (`idPedagio`) — criarViagem.idAilog. */
  idAilog?: number;
  idCNP?: string;
  codigo?: string;
  idSemParar?: string;
  idConectcar?: string;
  idVeloe?: string;
  idMoveMais?: string;
  idRepom?: string;
}

export interface RouteDistanceFullResult {
  success: true;
  km_distance: number;
  toll_total_centavos: number;
  toll_tag_centavos: number;
  toll_plazas: TollPlaza[];
  /**
   * Ordered UF sequence along the route (ordemRoteiro + pedágios).
   * Hint for MDF-e UFPer — validate with uf-percurso.ts before sending to SEFAZ.
   */
  percurso_ufs_hint: string[];
  /** Ordered [lat, lng] pairs from WebRouter path for Leaflet rendering */
  polyline_coords: [number, number][];
  /** Encoded polyline string from WebRouter (path.polyline) for storage/decoding */
  encoded_polyline: string;
  /** WebRouter map visualization URL (requires salvarRota: true + retornaURLmapa: true) */
  url_mapa_view: string;
  /** WebRouter route ID for future queries (requires salvarRota: true) */
  id_rota: number | null;
  /** Endereços enviados ao roteirizador (origem → paradas → destino). */
  enderecos: ReturnType<typeof buildAddress>[];
}

export interface RouteDistanceFullError {
  success: false;
  error: string;
}

/**
 * Full route calculation: km + tolls + coordinates.
 * Same API call as calculateRouteDistance but extracts more data.
 */
export async function calculateRouteDistanceFull(
  originCep: string,
  destinationCep: string,
  waypointCeps: string[] = [],
  axesCount?: number
): Promise<RouteDistanceFullResult | RouteDistanceFullError> {
  const apiKey = getEnv('WEBROUTER_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'WEBROUTER_API_KEY not configured' };
  }

  const origin = sanitizeCep(originCep);
  const destination = sanitizeCep(destinationCep);
  const waypoints = waypointCeps.map(sanitizeCep).filter((c) => c.length === 8);

  if (origin.length !== 8 || destination.length !== 8) {
    return { success: false, error: 'Invalid origin or destination CEP' };
  }

  const allCeps = [origin, ...waypoints, destination];
  const addrs = await Promise.all(allCeps.map(fetchCityUf));

  const enderecos = allCeps.map((cep, i) => {
    const addr = addrs[i];
    return buildAddress(cep, i + 1, addr ?? undefined);
  });

  const categoriaVeiculo = axesToCategoriaVeiculo(axesCount);
  console.log(
    `[webrouter-full] categoriaVeiculo=${categoriaVeiculo} (axes=${axesCount ?? 'default'})`
  );

  const body = {
    autenticacao: { chaveAcesso: apiKey },
    rota: {
      enderecos,
      params: {
        categoriaVeiculo,
        perfilVeiculo: 'CAMINHAO',
        tipoCombustivel: 'DIESEL',
        tipoVeiculo: 'CAMINHAO',
        tipoCaminho: 'RAPIDA',
        priorizarRodovias: true,
        retornaURLmapa: true,
      },
    },
    salvarRota: true,
  };

  try {
    const res = await fetch(WEBROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[webrouter-full] HTTP ERROR ${res.status}:`, data?.mensagem);
      return { success: false, error: data?.mensagem || `WebRouter HTTP ${res.status}` };
    }

    const status = data?.status ?? '';
    if (status !== 'SUCESSO' && status !== '') {
      console.error(`[webrouter-full] API ERROR status="${status}":`, data?.mensagem);
      return { success: false, error: data?.mensagem || `WebRouter status: ${status}` };
    }

    const rota = Array.isArray(data?.rotas) ? data.rotas[0] : null;
    const km = rota?.path?.distanciaKM;

    if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) {
      console.error(`[webrouter-full] Invalid distance km:`, km);
      return { success: false, error: 'WebRouter did not return valid distance' };
    }

    console.log(`[webrouter-full] ✓ API call successful | status="${status}" | km=${km}`);

    // Extract tolls from individual plazas (more reliable than custos.pedagio)
    const tollPlazas = extractTollPlazas(rota);
    // Sum individual plaza values (already in reais) → convert to centavos
    const tollFromPlazas = tollPlazas.reduce((sum, p) => sum + (p.valor || 0), 0);
    const tollTagFromPlazas = tollPlazas.reduce((sum, p) => sum + (p.valorTag || 0), 0);
    // Fallback to custos.pedagio if no plazas
    const custos = rota?.custos ?? {};
    const tollTotal =
      tollFromPlazas > 0
        ? Math.round(tollFromPlazas * 100)
        : Math.round((Number(custos?.pedagio) || 0) * 100);
    const tollTag =
      tollTagFromPlazas > 0
        ? Math.round(tollTagFromPlazas * 100)
        : Math.round((Number(custos?.pedagioTag) || 0) * 100);

    const fmtBRL = (v: number) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v);
    console.log(`[webrouter-full] 📊 TOLL CALCULATION:`);
    console.log(`  ├─ informacaoPedagios.result.pedagios count: ${tollPlazas.length}`);
    console.log(
      `  ├─ sum from plazas: ${fmtBRL(tollFromPlazas)} (${Math.round(tollFromPlazas * 100)}¢)`
    );
    console.log(
      `  ├─ custos.pedagio (fallback): ${custos?.pedagio} → ${Math.round((Number(custos?.pedagio) || 0) * 100)}¢`
    );
    console.log(`  ├─ tollFromPlazas > 0? ${tollFromPlazas > 0}`);
    console.log(
      `  └─ FINAL: tollTotal=${tollTotal}¢ (${fmtBRL(tollTotal / 100)}), tollTag=${tollTag}¢`
    );

    // Extract encoded polyline (complete route path from manual: path.polyline)
    const pathObj = rota?.path as Record<string, unknown> | undefined;
    const encodedPolyline = String(pathObj?.polyline ?? '');
    const urlMapaView = String(pathObj?.urlMapaView ?? '');
    const idRota = typeof rota?.idRota === 'number' ? rota.idRota : null;

    // Extract coordinates from ordemRoteiro (waypoints with lat/lng)
    const polylineCoords = extractPolylineCoords(rota);
    const percursoHint = extractPercursoUfsHint(rota, tollPlazas);
    console.log(
      `[webrouter-full] polyline: ${encodedPolyline.length} chars, coords: ${polylineCoords.length}, urlMapa: ${urlMapaView ? 'yes' : 'no'}, idRota: ${idRota}, percursoUFs=${percursoHint.join('-') || '(none)'}`
    );

    return {
      success: true,
      km_distance: Math.round(km * 10) / 10,
      toll_total_centavos: tollTotal,
      toll_tag_centavos: tollTag,
      toll_plazas: tollPlazas,
      percurso_ufs_hint: percursoHint,
      polyline_coords: polylineCoords,
      encoded_polyline: encodedPolyline,
      url_mapa_view: urlMapaView,
      id_rota: idRota,
      enderecos,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'WebRouter fetch failed' };
  }
}

function extractTollPlazas(rota: Record<string, unknown> | null): TollPlaza[] {
  if (!rota) return [];
  try {
    const info = rota.informacaoPedagios as Record<string, unknown> | undefined;
    const result = info?.result as Record<string, unknown> | undefined;
    const pedagios = result?.pedagios;
    if (!Array.isArray(pedagios)) return [];

    return pedagios.map((p: Record<string, unknown>) => {
      const cidade = p.cidade as Record<string, unknown> | undefined;
      const idAilogRaw = p.idAilog ?? p.idAILOG ?? p.id_ailog ?? p.idPedagio ?? p.id;
      const idAilog = Number(idAilogRaw);
      const idCnp = p.idCNP ?? p.idANTT;
      return {
        nome: String(p.nome || ''),
        cidade: String(cidade?.cidade || ''),
        uf: String(cidade?.uf || ''),
        valor: Number(p.valor) || 0,
        valorTag: Number(p.valorTag) || 0,
        ordemPassagem: Number(p.ordemPassagem) || 0,
        idAilog: Number.isFinite(idAilog) && idAilog > 0 ? idAilog : undefined,
        idCNP: idCnp != null && String(idCnp).trim() ? String(idCnp) : undefined,
        codigo: p.codigo != null ? String(p.codigo) : undefined,
        idSemParar: p.idSemParar != null ? String(p.idSemParar) : undefined,
        idConectcar: p.idConectcar != null ? String(p.idConectcar) : undefined,
        idVeloe: p.idVeloe != null ? String(p.idVeloe) : undefined,
        idMoveMais: p.idMoveMais != null ? String(p.idMoveMais) : undefined,
        idRepom: p.idRepom != null ? String(p.idRepom) : undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Ordered UFs along WebRouter route for MDF-e percurso hint.
 * Primary signal = pedágios (ordemPassagem); bookends = ordemRoteiro (origem/destino).
 * Dedups consecutive. Does NOT strip UFIni/UFFim — caller (uf-percurso) does.
 */
export function extractPercursoUfsHint(
  rota: Record<string, unknown> | null,
  tollPlazas: TollPlaza[] = []
): string[] {
  const norm = (u: unknown) =>
    String(u ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);

  const dedup = (arr: string[]) => {
    const out: string[] = [];
    for (const u of arr) {
      if (u.length === 2 && out[out.length - 1] !== u) out.push(u);
    }
    return out;
  };

  const roteiroUfs: string[] = [];
  const ordemRoteiro = rota?.ordemRoteiro;
  if (Array.isArray(ordemRoteiro)) {
    const pts = [...ordemRoteiro].sort(
      (a, b) =>
        Number((a as Record<string, unknown>).ordemPassagem) -
        Number((b as Record<string, unknown>).ordemPassagem)
    );
    for (const ponto of pts) {
      const p = ponto as Record<string, unknown>;
      const cidade = p.cidade as Record<string, unknown> | undefined;
      const uf = norm(cidade?.uf ?? p.uf);
      if (uf.length === 2) roteiroUfs.push(uf);
    }
  }

  const tollUfs = [...tollPlazas]
    .sort((a, b) => a.ordemPassagem - b.ordemPassagem)
    .map((t) => norm(t.uf))
    .filter((u) => u.length === 2);

  // Prefer: origem roteiro → pedágios → destino roteiro (mais denso que só extremos)
  if (tollUfs.length > 0) {
    const first = roteiroUfs[0];
    const last = roteiroUfs[roteiroUfs.length - 1];
    return dedup([...(first ? [first] : []), ...tollUfs, ...(last ? [last] : [])]);
  }
  return dedup(roteiroUfs);
}

/**
 * Extract route coordinates from WebRouter response.
 * Tries ordemRoteiro (waypoints with accumulated lat/lng), then pathSegments.
 */
function extractPolylineCoords(rota: Record<string, unknown> | null): [number, number][] {
  if (!rota) return [];

  // Try ordemRoteiro — ordered waypoints with latLng nested object
  const ordemRoteiro = rota.ordemRoteiro;
  if (Array.isArray(ordemRoteiro) && ordemRoteiro.length >= 2) {
    const coords: [number, number][] = [];
    for (const ponto of ordemRoteiro) {
      const p = ponto as Record<string, unknown>;
      // WebRouter nests coords in latLng: { latitude, longitude }
      const latLngObj = p.latLng as Record<string, unknown> | undefined;
      const lat = Number(latLngObj?.latitude ?? p.latitude);
      const lng = Number(latLngObj?.longitude ?? p.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        coords.push([lat, lng]);
      }
    }
    if (coords.length >= 2) return coords;
  }

  // Try path.coordenadas (if available)
  const path = rota.path as Record<string, unknown> | undefined;
  if (path) {
    const coordenadas = path.coordenadas;
    if (Array.isArray(coordenadas) && coordenadas.length >= 2) {
      const coords: [number, number][] = [];
      for (const c of coordenadas) {
        const lat = Number((c as Record<string, unknown>)?.latitude ?? (c as number[])?.[0]);
        const lng = Number((c as Record<string, unknown>)?.longitude ?? (c as number[])?.[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          coords.push([lat, lng]);
        }
      }
      if (coords.length >= 2) return coords;
    }
  }

  return [];
}

/**
 * Haversine distance between two lat/lng points (km).
 * Used as fast proxy when WebRouter is unavailable or for pre-filtering.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
