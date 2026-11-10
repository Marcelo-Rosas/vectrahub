/**
 * Km rodoviário CEP → CEP sem WebRouter.
 * Geocode: BrasilAPI v2 → ViaCEP/BrasilAPI/OpenCEP + Nominatim por cidade → Nominatim por CEP.
 * Rota: OpenRouteService driving-hgv (ORS_API_KEY); reserva: OSRM público (carro).
 */

type Point = { lat: number; lon: number; display_name: string };

const UA = 'VectraHub/1.0 (distance-calc)';
const ORS_BASE = 'https://api.openrouteservice.org';

export function sanitizeCep(v: unknown): string {
  return String(v ?? '')
    .replace(/\D/g, '')
    .slice(0, 8);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 8000
): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

async function geocodeBrasilApi(cep: string): Promise<Point | null> {
  try {
    const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!res?.ok) return null;
    const j = await res.json();
    const c = j?.location?.coordinates;
    const lat = Number(c?.latitude);
    const lon = Number(c?.longitude);
    if (c && Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon, display_name: `${j.city || ''}, ${j.state || ''}` };
    }
  } catch {
    // ignore
  }
  return null;
}

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
      const res = await fetchWithTimeout(s.url);
      if (res?.ok) {
        const addr = s.get(await res.json());
        if (addr) return addr;
      }
    } catch {
      // continue
    }
  }
  return null;
}

async function geocodeNominatim(params: {
  q?: string;
  postalcode?: string;
}): Promise<Point | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', 'Brazil');
    if (params.postalcode) url.searchParams.set('postalcode', params.postalcode);
    if (params.q) url.searchParams.set('q', params.q);
    const res = await fetchWithTimeout(url.toString(), {}, 5000);
    if (!res?.ok) return null;
    const item = (await res.json())?.[0];
    if (!item?.lat || !item?.lon) return null;
    return { lat: Number(item.lat), lon: Number(item.lon), display_name: item.display_name || '' };
  } catch {
    return null;
  }
}

export async function geocodeCep(cep: string): Promise<Point | null> {
  const viaApi = await geocodeBrasilApi(cep);
  if (viaApi) return viaApi;
  const addr = await fetchAddressFromCep(cep);
  if (addr) {
    const byCity = await geocodeNominatim({ q: `${addr.localidade}, ${addr.uf}, Brazil` });
    if (byCity) return byCity;
  }
  return await geocodeNominatim({ postalcode: cep });
}

async function orsKm(from: Point, to: Point, apiKey: string): Promise<number | null> {
  const res = await fetchWithTimeout(
    `${ORS_BASE}/v2/directions/driving-hgv/json`,
    {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [
          [from.lon, from.lat],
          [to.lon, to.lat],
        ],
        // Centroide de CEP pode cair longe da via: aceita ponto roteável em até 5 km.
        radiuses: [5000, 5000],
        instructions: false,
      }),
    },
    15000
  );
  if (!res?.ok) {
    console.warn('[cep-route-km] ORS', res?.status ?? 'sem resposta');
    return null;
  }
  const meters = (await res.json())?.routes?.[0]?.summary?.distance;
  return typeof meters === 'number' && meters > 0 ? meters / 1000 : null;
}

async function osrmKm(from: Point, to: Point): Promise<number | null> {
  const res = await fetchWithTimeout(
    `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`
  );
  if (!res?.ok) return null;
  const meters = (await res.json())?.routes?.[0]?.distance;
  return typeof meters === 'number' && meters > 0 ? meters / 1000 : null;
}

export type CepRouteKm =
  | {
      success: true;
      km_distance: number;
      origin: Point;
      destination: Point;
      source: 'ors' | 'osrm';
    }
  | { success: false; error: string; status: number };

/** Km entre dois pontos já geocodificados (ORS caminhão; reserva OSRM). */
export async function routeKmBetween(
  from: Point,
  to: Point
): Promise<{ km: number; source: 'ors' | 'osrm' } | null> {
  const apiKey = (Deno.env.get('ORS_API_KEY') ?? '').trim();
  if (apiKey) {
    const km = await orsKm(from, to, apiKey);
    if (km) return { km, source: 'ors' };
  }
  const km = await osrmKm(from, to);
  return km ? { km, source: 'osrm' } : null;
}

export async function cepRouteKm(originCep: string, destinationCep: string): Promise<CepRouteKm> {
  const o = sanitizeCep(originCep);
  const d = sanitizeCep(destinationCep);
  if (o.length !== 8 || d.length !== 8)
    return { success: false, error: 'CEPs inválidos', status: 400 };
  const [from, to] = await Promise.all([geocodeCep(o), geocodeCep(d)]);
  if (!from || !to) {
    return { success: false, error: 'Não foi possível geocodificar um dos CEPs', status: 422 };
  }
  const r = await routeKmBetween(from, to);
  if (!r) return { success: false, error: 'Não foi possível calcular a rota', status: 502 };
  return {
    success: true,
    km_distance: Math.round(r.km * 10) / 10,
    origin: from,
    destination: to,
    source: r.source,
  };
}
