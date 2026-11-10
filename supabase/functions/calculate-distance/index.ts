/// <reference path="../_shared/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { cepRouteKm, routeKmBetween, sanitizeCep } from '../_shared/cep-route-km.ts';

type CepInput = {
  origin_cep: string;
  destination_cep: string;
};
type CoordInput = {
  origin: { lat: number; lon: number };
  destination: { lat: number; lon: number };
};
type Input = CepInput | CoordInput;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });

  try {
    const body = (await req.json()) as Partial<Input>;

    if ('origin' in body && 'destination' in body && body.origin && body.destination) {
      const o = body.origin as { lat?: number; lon?: number };
      const d = body.destination as { lat?: number; lon?: number };
      if (
        typeof o?.lat !== 'number' ||
        typeof o?.lon !== 'number' ||
        typeof d?.lat !== 'number' ||
        typeof d?.lon !== 'number'
      ) {
        return reply({ success: false, error: 'Coordenadas inválidas' }, 400);
      }
      const from = { lat: o.lat, lon: o.lon, display_name: '' };
      const to = { lat: d.lat, lon: d.lon, display_name: '' };
      const r = await routeKmBetween(from, to);
      if (!r) return reply({ success: false, error: 'Não foi possível calcular a rota' }, 502);
      return reply({
        success: true,
        data: {
          km_distance: Math.round(r.km * 10) / 10,
          origin: from,
          destination: to,
          source: `client+${r.source}`,
        },
      });
    }

    const originCep = sanitizeCep((body as Partial<CepInput>).origin_cep);
    const destinationCep = sanitizeCep((body as Partial<CepInput>).destination_cep);
    const r = await cepRouteKm(originCep, destinationCep);
    if (!r.success) return reply({ success: false, error: r.error }, r.status);
    return reply({
      success: true,
      data: {
        km_distance: r.km_distance,
        origin: { ...r.origin, cep: originCep },
        destination: { ...r.destination, cep: destinationCep },
        source: `brasilapi+${r.source}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return reply({ success: false, error: msg }, 500);
  }
});
