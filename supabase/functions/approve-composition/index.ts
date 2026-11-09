/**
 * Edge Function: approve-composition
 * Approves a composition suggestion and creates consolidated order
 *
 * Input:
 *   - composition_id: UUID — suggestion to approve
 *   - user_id: UUID — approving user
 *   - notes: string (optional) — additional notes
 *
 * Output:
 *   - success: boolean
 *   - order_id: UUID — created consolidated order
 *   - status: string — execution status
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ApproveCompositionRequest {
  composition_id: string;
  user_id: string;
  notes?: string;
}

interface CompositionSuggestion {
  id: string;
  shipper_id: string;
  quote_ids: string[];
  consolidation_score: number;
  estimated_savings_brl: number;
  distance_increase_percent: number;
  status: string;
}

interface RoutingLeg {
  composition_id: string;
  route_sequence: number;
  quote_id: string;
  leg_distance_km: number;
  leg_duration_min: number;
  leg_polyline: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  estimated_arrival?: string;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ApproveCompositionRequest;
    const { composition_id, user_id, notes = '' } = body;

    if (!composition_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: composition_id, user_id' }),
        { status: 400 }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[approve-composition] Processing composition: ${composition_id}`);

    // 1. Fetch suggestion
    const { data: suggestion, error: suggError } = await supabase
      .from('load_composition_suggestions')
      .select('*')
      .eq('id', composition_id)
      .single();

    if (suggError || !suggestion) {
      throw new Error(`Suggestion not found: ${suggError?.message}`);
    }

    const comp = suggestion as CompositionSuggestion;

    // 2. Fetch quotes to get details for order
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .in('id', comp.quote_ids);

    if (quotesError || !quotes) {
      throw new Error(`Failed to fetch quotes: ${quotesError?.message}`);
    }

    // 3. Fetch routings
    const { data: routings, error: routingsError } = await supabase
      .from('load_composition_routings')
      .select('*')
      .eq('composition_id', composition_id)
      .order('route_sequence', { ascending: true });

    if (routingsError) {
      throw new Error(`Failed to fetch routings: ${routingsError?.message}`);
    }

    // 4. Create consolidated order
    const orderData = {
      shipper_id: comp.shipper_id,
      origin: quotes[0]?.origin || 'Warehouse',
      destination: quotes[0]?.destination || 'Warehouse',
      status: 'pending_driver_assignment',
      type: 'consolidation',
      estimated_km:
        (routings as RoutingLeg[])?.reduce((sum, r) => sum + (r.leg_distance_km || 0), 0) || 0,
      estimated_duration_min:
        (routings as RoutingLeg[])?.reduce((sum, r) => sum + (r.leg_duration_min || 0), 0) || 0,
      notes: `Consolidated from quotes: ${comp.quote_ids.join(', ')}. ${notes}`,
      consolidated_from: comp.quote_ids, // array of quote_ids
      created_by: user_id,
    };

    const { data: createdOrder, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError || !createdOrder) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    console.log(`[approve-composition] Created order: ${createdOrder.id}`);

    // 5. Update quotes to link to order
    const { error: updateQuotesError } = await supabase
      .from('quotes')
      .update({
        linked_order_id: createdOrder.id,
        status: 'consolidated',
      })
      .in('id', comp.quote_ids);

    if (updateQuotesError) {
      console.error(`[approve-composition] Warning: Failed to update quotes:`, updateQuotesError);
    }

    // 6. Update composition status
    const { error: updateSuggError } = await supabase
      .from('load_composition_suggestions')
      .update({
        status: 'executed',
        approved_by: user_id,
        approved_at: new Date().toISOString(),
        created_order_id: createdOrder.id,
      })
      .eq('id', composition_id);

    if (updateSuggError) {
      console.error(`[approve-composition] Warning: Failed to update suggestion:`, updateSuggError);
    }

    // 7. Save financial metrics
    const estimatedConsolidatedCost =
      (quotes as any[])?.reduce((sum, q) => sum + (q.estimated_cost || 0), 0) * 0.7;
    const totalOriginalCost = (quotes as any[])?.reduce(
      (sum, q) => sum + (q.estimated_cost || 0),
      0
    );

    const savingsPercent =
      totalOriginalCost > 0
        ? Math.round(((totalOriginalCost - estimatedConsolidatedCost) / totalOriginalCost) * 1000) /
          10
        : 0;

    const { error: metricsError } = await supabase.from('load_composition_metrics').insert({
      composition_id,
      original_total_cost: Math.round(totalOriginalCost),
      composed_total_cost: Math.round(estimatedConsolidatedCost),
      savings_brl: Math.round(totalOriginalCost - estimatedConsolidatedCost),
      savings_percent: savingsPercent,
      original_km_total: 0, // Would calculate from separate quote routes
      composed_km_total:
        (routings as RoutingLeg[])?.reduce((sum, r) => sum + (r.leg_distance_km || 0), 0) || 0,
    });

    if (metricsError) {
      console.error(`[approve-composition] Warning: Failed to save metrics:`, metricsError);
    }

    // 8. Get shipper info for notification
    const { data: shipper, error: shipperError } = await supabase
      .from('shippers')
      .select('id, name, email, phone')
      .eq('id', comp.shipper_id)
      .single();

    if (!shipperError && shipper) {
      // 9. Send WhatsApp notification (via notification-hub)
      try {
        const notificationPayload = {
          type: 'composition_approved',
          shipper_id: comp.shipper_id,
          message: `✅ Sua composição de ${comp.quote_ids.length} cargas foi aprovada! Economia: R$ ${(comp.estimated_savings_brl / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Ordem de Serviço: ${createdOrder.id}`,
          cta_url: `/operacional?order=${createdOrder.id}`,
          channels: ['whatsapp', 'email'],
        };

        // Call notification-hub Edge Function
        const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/notification-hub`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(notificationPayload),
        });

        if (!notificationResponse.ok) {
          console.warn(`[approve-composition] Notification failed: ${notificationResponse.status}`);
        } else {
          console.log(`[approve-composition] Notification sent to shipper`);
        }
      } catch (e) {
        console.error(`[approve-composition] Error sending notification:`, e);
      }
    }

    console.log(`[approve-composition] Successfully approved composition ${composition_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        composition_id,
        order_id: createdOrder.id,
        status: 'executed',
        timestamp: new Date().toISOString(),
        summary: {
          quotes_consolidated: comp.quote_ids.length,
          estimated_savings_brl: comp.estimated_savings_brl,
          estimated_km:
            (routings as RoutingLeg[])?.reduce((sum, r) => sum + (r.leg_distance_km || 0), 0) || 0,
          order_status: createdOrder.status,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[approve-composition] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
