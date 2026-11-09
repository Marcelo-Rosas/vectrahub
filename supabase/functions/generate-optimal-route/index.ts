/**
 * Edge Function: generate-optimal-route (v2)
 *
 * Generates route for a load composition using WebRouter (real distances + polyline).
 * Replaces the v1 mock TSP with real CEP-based routing.
 *
 * Input:
 *   - quote_ids: UUID[] — quotes to route (min 2)
 *   - composition_id: UUID (optional) — saves routings to DB
 *   - save_to_db: boolean (default: true)
 *
 * Output:
 *   - route.legs: RouteLeg[] with real km, duration, toll, polyline
 *   - route.total_distance_km, total_duration_min, total_toll_centavos
 *   - route.polyline_coords: full route coordinates for map rendering
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  calculateRouteDistanceFull,
  calculateRouteDistance,
  type RouteDistanceFullResult,
  type TollPlaza,
} from '../_shared/webrouter-client.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateRouteRequest {
  quote_ids: string[];
  composition_id?: string;
  save_to_db?: boolean;
  /** Number of axes for toll calculation (maps to WebRouter categoriaVeiculo) */
  axes_count?: number;
}

interface QuoteRow {
  id: string;
  origin: string;
  destination: string;
  origin_cep: string | null;
  destination_cep: string | null;
  weight: number | null;
  km_distance: number | null;
  quote_code: string | null;
  client_name: string;
  estimated_loading_date: string | null;
}

interface RouteLeg {
  from_label: string;
  to_label: string;
  distance_km: number;
  duration_min: number;
  quote_id: string | null;
  sequence_number: number;
  toll_centavos: number;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = (await req.json()) as GenerateRouteRequest;
    const { quote_ids, composition_id, save_to_db = true, axes_count } = body;

    if (!quote_ids || quote_ids.length < 2) {
      return jsonResponse({ error: 'At least 2 quote_ids required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase configuration');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch quotes with real columns
    const { data: quotes, error: quoteError } = await supabase
      .from('quotes')
      .select(
        'id, origin, destination, origin_cep, destination_cep, weight, km_distance, quote_code, client_name, estimated_loading_date'
      )
      .in('id', quote_ids);

    if (quoteError || !quotes || quotes.length < 2) {
      return jsonResponse(
        {
          error: `Failed to fetch quotes: ${quoteError?.message ?? 'not enough quotes found'}`,
        },
        400
      );
    }

    const typedQuotes = quotes as QuoteRow[];
    console.log(`[generate-optimal-route] Fetched ${typedQuotes.length} quotes`);

    // 2. Sort by km_distance desc — longest route = main, others = waypoints
    const sorted = [...typedQuotes].sort(
      (a, b) => (Number(b.km_distance) || 0) - (Number(a.km_distance) || 0)
    );
    const mainQuote = sorted[0];
    const secondaryQuotes = sorted.slice(1);

    // Check CEPs
    const originCep = (mainQuote.origin_cep ?? '').replace(/\D/g, '');
    const destCep = (mainQuote.destination_cep ?? '').replace(/\D/g, '');

    if (originCep.length !== 8 || destCep.length !== 8) {
      console.warn(
        `[generate-optimal-route] Main quote CEPs invalid (origin=${originCep.length}digits, dest=${destCep.length}digits) — using fallback`
      );
      const fallback = buildFallbackRoute(typedQuotes);

      // FIX: Persist fallback route to DB so reopening the composition still shows data.
      // Without this, approve-composition sums an empty routings set to 0 km / 0 duration.
      if (composition_id && save_to_db) {
        await saveRoutingsToDB(supabase, composition_id, fallback.legs);
      }

      return jsonResponse(
        {
          success: true,
          route: {
            ...fallback,
            toll_plazas: [],
            polyline_coords: [],
            composition_id: composition_id || null,
            route_source: 'fallback_km',
          },
          timestamp: new Date().toISOString(),
        },
        200
      );
    }

    // 3. Build waypoints: secondary origins (if different from main) + secondary destinations
    // FIX: For mixed-origin compositions, we must include pickup points for secondary quotes.
    // Without this, only the main quote's origin is sent to WebRouter, understating km/tolls.
    const waypointCeps: string[] = [];
    const seenCeps = new Set<string>([originCep, destCep]); // avoid duplicating origin/dest

    for (const q of secondaryQuotes) {
      // Add secondary origin if it differs from main origin (mixed-origin composition)
      const secOriginCep = (q.origin_cep ?? '').replace(/\D/g, '');
      if (secOriginCep.length === 8 && !seenCeps.has(secOriginCep)) {
        waypointCeps.push(secOriginCep);
        seenCeps.add(secOriginCep);
      }

      // Add secondary destination
      const secDestCep = (q.destination_cep ?? '').replace(/\D/g, '');
      if (secDestCep.length === 8 && !seenCeps.has(secDestCep)) {
        waypointCeps.push(secDestCep);
        seenCeps.add(secDestCep);
      }
    }

    console.log(
      `[generate-optimal-route] Waypoints: ${waypointCeps.length} (origins+destinations from ${secondaryQuotes.length} secondary quotes)`
    );

    // 4. Call WebRouter Full
    console.log(
      `[generate-optimal-route] Calling WebRouter with: origin=${originCep}, dest=${destCep}, waypoints=${waypointCeps.length}`
    );

    const routeResult = await calculateRouteDistanceFull(
      originCep,
      destCep,
      waypointCeps,
      axes_count
    );

    let legs: RouteLeg[];
    let totalDistanceKm: number;
    let totalDurationMin: number;
    let totalTollCentavos: number;
    let tollPlazas: TollPlaza[] = [];
    let polylineCoords: [number, number][] = [];
    let encodedPolyline = '';
    let urlMapaView = '';
    let webrouterIdRota: number | null = null;

    if (routeResult.success) {
      const fullResult = routeResult as RouteDistanceFullResult;
      totalDistanceKm = fullResult.km_distance;
      totalDurationMin = Math.round((totalDistanceKm / 60) * 60); // 60 km/h avg
      totalTollCentavos = fullResult.toll_total_centavos;
      tollPlazas = fullResult.toll_plazas;
      polylineCoords = fullResult.polyline_coords;
      encodedPolyline = fullResult.encoded_polyline ?? '';
      urlMapaView = fullResult.url_mapa_view ?? '';
      webrouterIdRota = fullResult.id_rota ?? null;

      // Build legs: origin → each waypoint → destination
      legs = buildLegsFromRoute(mainQuote, secondaryQuotes, totalDistanceKm, totalTollCentavos);

      const fmtBRL = (c: number) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(c / 100);
      console.log(
        `[generate-optimal-route] WebRouter SUCCESS ✓ | distance=${totalDistanceKm}km | toll=${totalTollCentavos}¢ (${fmtBRL(totalTollCentavos)}) | plazas=${tollPlazas.length} | coords=${polylineCoords.length}`
      );

      // Diagnostic: warn if toll is zero despite successful call
      if (totalTollCentavos === 0) {
        console.warn(
          `[generate-optimal-route] ⚠️ WebRouter returned ZERO TOLL despite success. Possible causes: 1) Route has no toll plazas, 2) custos.pedagio = 0, 3) informacaoPedagios empty`
        );
      }
    } else {
      // Fallback: use stored km_distance
      const errorMsg = 'error' in routeResult ? routeResult.error : 'unknown error';
      console.warn(
        `[generate-optimal-route] WebRouter FAILED ✗ | error="${errorMsg}" | using fallback with zero toll`
      );
      const fallback = buildFallbackRoute(typedQuotes);
      legs = fallback.legs;
      totalDistanceKm = fallback.total_distance_km;
      totalDurationMin = fallback.total_duration_min;
      totalTollCentavos = 0;
    }

    // 5. Save to DB if composition_id provided
    if (composition_id && save_to_db) {
      await saveRoutingsToDB(supabase, composition_id, legs);

      // Persist toll + polyline + map URL on the suggestion row
      const { error: updateErr } = await supabase
        .from('load_composition_suggestions')
        .update({
          total_toll_centavos: totalTollCentavos,
          total_toll_tag_centavos: routeResult.success
            ? (routeResult as RouteDistanceFullResult).toll_tag_centavos
            : 0,
          encoded_polyline: encodedPolyline || null,
          url_mapa_view: urlMapaView || null,
          webrouter_id_rota: webrouterIdRota,
        })
        .eq('id', composition_id);
      if (updateErr) {
        console.error(
          '[generate-optimal-route] Failed to update suggestion with toll/polyline:',
          updateErr.message
        );
      }
    }

    return jsonResponse({
      success: true,
      route: {
        legs,
        total_distance_km: totalDistanceKm,
        total_duration_min: totalDurationMin,
        total_toll_centavos: totalTollCentavos,
        toll_plazas: tollPlazas,
        polyline_coords: polylineCoords,
        encoded_polyline: encodedPolyline,
        url_mapa_view: urlMapaView,
        composition_id: composition_id || null,
        route_source: routeResult.success ? 'webrouter' : 'fallback_km',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[generate-optimal-route] Error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLegsFromRoute(
  mainQuote: QuoteRow,
  secondaryQuotes: QuoteRow[],
  totalKm: number,
  totalTollCentavos: number
): RouteLeg[] {
  const legs: RouteLeg[] = [];

  // Build stops list: main origin → [secondary pickups & deliveries] → main destination
  // For mixed-origin compositions, secondary origins are added as intermediate pickup stops.
  const mainOriginCep = (mainQuote.origin_cep ?? '').replace(/\D/g, '');
  const seenLabels = new Set<string>();

  const allStops: { label: string; quoteId: string | null; km: number }[] = [
    { label: mainQuote.origin.split(',')[0], quoteId: null, km: 0 },
  ];
  seenLabels.add(mainQuote.origin.split(',')[0]);

  for (const q of secondaryQuotes) {
    // Add pickup stop if origin differs from main origin
    const secOriginCep = (q.origin_cep ?? '').replace(/\D/g, '');
    const pickupLabel = q.origin.split(',')[0];
    if (
      secOriginCep.length === 8 &&
      secOriginCep !== mainOriginCep &&
      !seenLabels.has(pickupLabel)
    ) {
      allStops.push({ label: `${pickupLabel} (coleta)`, quoteId: null, km: 0 });
      seenLabels.add(pickupLabel);
    }

    // Add delivery stop
    allStops.push({
      label: q.destination.split(',')[0],
      quoteId: q.id,
      km: Number(q.km_distance) || 0,
    });
  }

  allStops.push({
    label: mainQuote.destination.split(',')[0],
    quoteId: mainQuote.id,
    km: Number(mainQuote.km_distance) || 0,
  });

  // Distribute km proportionally
  const totalStoredKm = allStops.reduce((s, st) => s + st.km, 0) || totalKm;
  const tollPerKm = totalStoredKm > 0 ? totalTollCentavos / totalStoredKm : 0;

  for (let i = 0; i < allStops.length - 1; i++) {
    const from = allStops[i];
    const to = allStops[i + 1];
    // Estimate leg km proportionally
    const legKm =
      totalStoredKm > 0 ? (to.km / totalStoredKm) * totalKm : totalKm / (allStops.length - 1);

    legs.push({
      from_label: from.label,
      to_label: to.label,
      distance_km: Math.round(legKm * 10) / 10,
      duration_min: Math.round((legKm / 60) * 60),
      quote_id: to.quoteId,
      sequence_number: i + 1,
      toll_centavos: Math.round(legKm * tollPerKm),
    });
  }

  return legs;
}

function buildFallbackRoute(quotes: QuoteRow[]) {
  const sorted = [...quotes].sort(
    (a, b) => (Number(b.km_distance) || 0) - (Number(a.km_distance) || 0)
  );
  const mainQuote = sorted[0];
  const secondaryQuotes = sorted.slice(1);

  // FIX: Estimate consolidated distance instead of raw sum.
  // Raw sum overstates the route (e.g., NGS→SP 600km + NGS→CWB 200km = 800km,
  // but consolidated NGS→CWB→SP ≈ 600km). Use the same heuristic as analyze-load-composition.
  const mainKm = Number(mainQuote.km_distance) || 0;
  const secondaryKmSum = secondaryQuotes.reduce((s, q) => s + (Number(q.km_distance) || 0), 0);

  // Check if origins match
  const mainOriginCep = (mainQuote.origin_cep ?? '').replace(/\D/g, '');
  const originsMatch = secondaryQuotes.every((q) => {
    const cep = (q.origin_cep ?? '').replace(/\D/g, '');
    return cep === mainOriginCep;
  });

  // Shared origin: 30% extra from secondaries (70% is shared corridor)
  // Different origins: 40% extra (less corridor overlap)
  const overlapFactor = originsMatch ? 0.3 : 0.4;
  const estimatedConsolidatedKm = mainKm + secondaryKmSum * overlapFactor;

  // Use the larger of: estimated consolidated, or main route alone (never shrink below main)
  const totalKm = Math.max(mainKm, estimatedConsolidatedKm);
  const legs = buildLegsFromRoute(mainQuote, secondaryQuotes, totalKm, 0);

  return {
    legs,
    total_distance_km: Math.round(totalKm * 10) / 10,
    total_duration_min: Math.round((totalKm / 60) * 60),
    total_toll_centavos: 0,
  };
}

async function saveRoutingsToDB(
  supabase: ReturnType<typeof createClient>,
  compositionId: string,
  legs: RouteLeg[]
): Promise<void> {
  // Clear existing
  await supabase.from('load_composition_routings').delete().eq('composition_id', compositionId);

  const legsWithQuote = legs.filter((l) => l.quote_id != null);
  if (legsWithQuote.length === 0) return;

  const rows = legsWithQuote.map((leg) => ({
    composition_id: compositionId,
    route_sequence: leg.sequence_number,
    quote_id: leg.quote_id!,
    leg_distance_km: leg.distance_km,
    leg_duration_min: leg.duration_min,
    leg_polyline: '',
    is_feasible: true,
    toll_centavos: leg.toll_centavos,
  }));

  const { error } = await supabase.from('load_composition_routings').insert(rows);
  if (error) {
    console.error('[generate-optimal-route] DB insert error:', error.message);
  }
}
