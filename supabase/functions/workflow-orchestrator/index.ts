import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callEdgeFunction } from '../_shared/edgeFunctionClient.ts';

// workflow-orchestrator v70
// Alterações vs v69:
// - handleQuoteStageChanged: adicionado handler para new_stage === 'pending_approval'
//   que aciona o auto-approval-worker (LOW/MEDIUM → auto-aprova, HIGH/CRITICAL → manual)
// - Mantida arquitetura v69: execute_after, quote.ganho_deferred, idempotência de OS

interface WorkflowEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  max_retries: number;
  created_by: string | null;
  execute_after: string | null;
}

interface EventResult {
  success: boolean;
  actions: string[];
  error?: string;
}

type DenoLike = {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const deno = (globalThis as unknown as { Deno: DenoLike }).Deno;

function serviceClient(): SupabaseClient {
  return createClient(deno.env.get('SUPABASE_URL')!, deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function logAction(
  sb: SupabaseClient,
  eventId: string,
  action: string,
  agent: string,
  details: Record<string, unknown> = {}
) {
  await sb.from('workflow_event_logs').insert({ event_id: eventId, action, agent, details });
}

async function triggerNotificationHub(logId: string) {
  try {
    await callEdgeFunction('notification-hub', { logId });
  } catch {
    // Non-critical
  }
}

// ─────────────────────────────────────────────────────
// Quote Stage Changed
// ─────────────────────────────────────────────────────

async function handleQuoteStageChanged(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { new_stage, old_stage, client_email, order_id } = event.payload;
  const actions: string[] = [];

  // ── NEW: pending_approval → acionar auto-approval-worker ──────────────────
  // LOW/MEDIUM  → aprovação automática → quote avança para 'ganho'
  // HIGH/CRITICAL → cria approval_request manual para admin
  // PAG: criado depois via ganho_deferred → order.created → handleOrderCreated
  if (new_stage === 'pending_approval') {
    try {
      const result = await callEdgeFunction('auto-approval-worker', {
        quote_id: event.entity_id,
        order_id: order_id as string | undefined,
        triggered_by: 'workflow-orchestrator',
      });
      if (result?.auto_approved) {
        actions.push(`auto_approved:criticality=${result.criticality}`);
      } else {
        actions.push(`manual_approval_required:criticality=${result?.criticality ?? 'unknown'}`);
      }
    } catch (e) {
      actions.push(`auto_approval_failed:${(e as Error).message}`);
    }
  }

  // ── ganho → notifica cliente; OS criada de forma diferida (ganho_deferred) ─
  if (new_stage === 'ganho') {
    const { data: quoteWonLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'quote_won',
        channel: 'email',
        recipient_email: client_email as string,
        status: 'pending',
        entity_type: 'quote',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (quoteWonLog) await triggerNotificationHub(quoteWonLog.id);
    actions.push('notification_queued:quote_won');
    actions.push('deferred:os_creation_scheduled_24h');

    try {
      const contractRes = (await callEdgeFunction('generate-contract-pdf', {
        quote_id: event.entity_id,
      })) as {
        contract_id?: string | null;
        partial?: boolean;
        success_count?: number;
        failed_sequences?: number[];
      };
      if (contractRes?.partial) {
        actions.push(
          `contract_partial:ok=${contractRes.success_count ?? 0}:failed=${(contractRes.failed_sequences ?? []).join(',')}`
        );
      } else if (contractRes?.success_count && contractRes.success_count > 0) {
        actions.push(`contracts_generated:${contractRes.success_count}`);
      } else if (contractRes?.contract_id) {
        actions.push(`contract_generated:${contractRes.contract_id}`);
      }
    } catch (e) {
      actions.push(`contract_generation_failed:${(e as Error).message}`);
    }
  }

  // ── precificacao → AI profitability analysis ──────────────────────────────
  if (new_stage === 'precificacao') {
    try {
      await callEdgeFunction('ai-orchestrator-agent', {
        analysisType: 'quote_profitability',
        entityId: event.entity_id,
        entityType: 'quote',
      });
      actions.push('ai_analysis:quote_profitability');
    } catch (e) {
      actions.push(`ai_analysis_failed:${(e as Error).message}`);
    }
  }

  if (new_stage === 'enviado') actions.push('quote_sent:tracked');

  if (actions.length === 0) actions.push(`no_action:${old_stage}->${new_stage}`);

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Order Created
// ─────────────────────────────────────────────────────

async function handleOrderCreated(sb: SupabaseClient, event: WorkflowEvent): Promise<EventResult> {
  const { carreteiro_antt } = event.payload;
  const actions: string[] = [];

  if (carreteiro_antt && Number(carreteiro_antt) > 0) {
    const { error: pagErr } = await sb.rpc('ensure_financial_document', {
      doc_type: 'PAG',
      source_id_in: event.entity_id,
      total_amount_in: Number(carreteiro_antt),
    });
    if (!pagErr) actions.push('pag_created');
    else actions.push(`pag_failed:${pagErr.message}`);
  }

  const { data: orderCreatedLog } = await sb
    .from('notification_logs')
    .insert({
      template_key: 'order_created',
      channel: 'email',
      status: 'pending',
      entity_type: 'order',
      entity_id: event.entity_id,
    })
    .select('id')
    .single();
  if (orderCreatedLog) await triggerNotificationHub(orderCreatedLog.id);
  actions.push('notification_queued:order_created');

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Order Stage Changed
// ─────────────────────────────────────────────────────

async function handleOrderStageChanged(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { new_stage, driver_phone, quote_id } = event.payload;
  const actions: string[] = [];

  if (new_stage === 'busca_motorista' && driver_phone) {
    const { data: driverLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'driver_assigned',
        channel: 'whatsapp',
        recipient_phone: driver_phone as string,
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (driverLog) await triggerNotificationHub(driverLog.id);
    actions.push('notification_queued:driver_assigned_whatsapp');

    try {
      await callEdgeFunction('ai-operational-agent', {
        analysisType: 'driver_qualification',
        entityId: event.entity_id,
        entityType: 'order',
        orderId: event.entity_id,
      });
      actions.push('ai_analysis:driver_qualification');
    } catch (e) {
      actions.push(`ai_analysis_failed:driver_qualification:${(e as Error).message}`);
    }
  }

  if (new_stage === 'documentacao') {
    try {
      await callEdgeFunction('ai-operational-agent', {
        analysisType: 'compliance_check',
        entityId: event.entity_id,
        entityType: 'order',
        checkType: 'pre_coleta',
      });
      actions.push('ai_analysis:compliance_check_pre_coleta');
    } catch (e) {
      actions.push(`ai_analysis_failed:compliance_check:${(e as Error).message}`);
    }
  }

  if (new_stage === 'entregue') {
    if (quote_id) {
      const { data: fatDoc } = await sb
        .from('financial_documents')
        .select('id, status')
        .eq('source_type', 'quote')
        .eq('source_id', quote_id as string)
        .maybeSingle();
      if (fatDoc && fatDoc.status === 'INCLUIR') {
        await sb.from('financial_documents').update({ status: 'GERADO' }).eq('id', fatDoc.id);
        actions.push('fat_advanced:GERADO');
      }
    }

    const { data: pagDoc } = await sb
      .from('financial_documents')
      .select('id, status')
      .eq('source_type', 'order')
      .eq('source_id', event.entity_id)
      .maybeSingle();
    if (pagDoc && pagDoc.status === 'INCLUIR') {
      await sb.from('financial_documents').update({ status: 'GERADO' }).eq('id', pagDoc.id);
      actions.push('pag_advanced:GERADO');
    }

    const { data: deliveryLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'delivery_confirmed',
        channel: 'both',
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (deliveryLog) await triggerNotificationHub(deliveryLog.id);
    actions.push('notification_queued:delivery_confirmed');
  }

  if (actions.length === 0) actions.push(`no_action:stage_${new_stage}`);
  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Financial Status Changed
// ─────────────────────────────────────────────────────

async function handleFinancialStatusChanged(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { new_status, total_amount, type, code } = event.payload;
  const actions: string[] = [];

  if (new_status === 'GERADO') {
    const amount = Number(total_amount) || 0;
    const { data: rules } = await sb
      .from('approval_rules')
      .select('*')
      .eq('entity_type', 'financial_document')
      .eq('active', true);

    let needsApproval = false;

    if (rules) {
      for (const rule of rules) {
        const condition = rule.trigger_condition as Record<string, unknown>;

        if (condition.field === 'total_amount') {
          const threshold = Number(condition.value) || 0;
          const operator = condition.operator as string;
          if (
            (operator === '>' && amount > threshold) ||
            (operator === '>=' && amount >= threshold)
          ) {
            const additional = condition.additional as Record<string, unknown> | undefined;
            if (additional) {
              if (event.payload[additional.field as string] !== additional.value) continue;
            }
            needsApproval = true;
            await sb.from('approval_requests').insert({
              entity_type: 'financial_document',
              entity_id: event.entity_id,
              approval_type: rule.approval_type,
              title: `Aprovação: ${code || type} — R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              description: `Documento financeiro ${type} no valor de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} requer aprovação.`,
              assigned_to_role: rule.approver_role,
              requested_by: event.created_by,
            });
            actions.push(`approval_created:${rule.approval_type}`);
            try {
              await callEdgeFunction('ai-orchestrator-agent', {
                analysisType: 'approval_summary',
                entityId: event.entity_id,
                entityType: 'financial_document',
              });
              actions.push('ai_analysis:approval_summary');
            } catch (e) {
              actions.push(`ai_analysis_failed:${(e as Error).message}`);
            }
            const { data: log1 } = await sb
              .from('notification_logs')
              .insert({
                template_key: 'approval_requested',
                channel: 'email',
                status: 'pending',
                entity_type: 'financial_document',
                entity_id: event.entity_id,
              })
              .select('id')
              .single();
            if (log1) await triggerNotificationHub(log1.id);
            actions.push('notification_queued:approval_requested');
            break;
          }
        }

        if (condition.field === 'type' && condition.operator === '=' && condition.value === type) {
          needsApproval = true;
          await sb.from('approval_requests').insert({
            entity_type: 'financial_document',
            entity_id: event.entity_id,
            approval_type: rule.approval_type,
            title: `Aprovação: ${code || type} — R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            description: `Documento financeiro ${type} requer aprovação do financeiro.`,
            assigned_to_role: rule.approver_role,
            requested_by: event.created_by,
          });
          actions.push(`approval_created:${rule.approval_type}`);
          const { data: log2 } = await sb
            .from('notification_logs')
            .insert({
              template_key: 'approval_requested',
              channel: 'email',
              status: 'pending',
              entity_type: 'financial_document',
              entity_id: event.entity_id,
            })
            .select('id')
            .single();
          if (log2) await triggerNotificationHub(log2.id);
          actions.push('notification_queued:approval_requested');
          break;
        }
      }
    }

    if (!needsApproval) {
      await sb
        .from('financial_documents')
        .update({ status: 'AGUARDANDO' })
        .eq('id', event.entity_id);
      actions.push('auto_advanced:AGUARDANDO');
    }
  }

  if (actions.length === 0) actions.push(`no_action:status_${new_status}`);
  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Approval Decided
// ─────────────────────────────────────────────────────

async function handleApprovalDecided(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { decision, entity_type, entity_id } = event.payload;
  const actions: string[] = [];

  if (decision === 'approved' && entity_type === 'financial_document') {
    const { data: doc } = await sb
      .from('financial_documents')
      .select('status')
      .eq('id', entity_id as string)
      .maybeSingle();
    if (doc && doc.status === 'GERADO') {
      await sb
        .from('financial_documents')
        .update({ status: 'AGUARDANDO' })
        .eq('id', entity_id as string);
      actions.push('auto_advanced:AGUARDANDO');
    }
  }

  const { data: log } = await sb
    .from('notification_logs')
    .insert({
      template_key: 'approval_decided',
      channel: 'email',
      status: 'pending',
      entity_type: entity_type as string,
      entity_id: entity_id as string,
    })
    .select('id')
    .single();
  if (log) await triggerNotificationHub(log.id);
  actions.push(`notification_queued:approval_${decision}`);

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Document Uploaded
// ─────────────────────────────────────────────────────

async function handleDocumentUploaded(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { type, order_id } = event.payload;
  const actions: string[] = [];
  if (!order_id) return { success: true, actions: ['no_action:no_order_id'] };

  const flagMap: Record<string, string> = {
    nfe: 'has_nfe',
    cte: 'has_cte',
    pod: 'has_pod',
    cnh: 'has_cnh',
    crlv: 'has_crlv',
    comp_residencia: 'has_comp_residencia',
    antt_motorista: 'has_antt',
    mdfe: 'has_mdfe',
    analise_gr: 'has_analise_gr',
    doc_rota: 'has_doc_rota',
    comprovante_vpo: 'has_vpo',
  };
  const flag = flagMap[type as string];
  if (flag) {
    await sb
      .from('orders')
      .update({ [flag]: true })
      .eq('id', order_id as string);
    actions.push(`flag_set:${flag}`);
  }

  if (['a_vista_pag', 'adiantamento_carreteiro', 'saldo_carreteiro'].includes(type as string)) {
    try {
      await callEdgeFunction('process-payment-proof', { documentId: event.entity_id });
      actions.push('payment_proof_processing_triggered');
    } catch (e) {
      actions.push(`payment_proof_failed:${(e as Error).message}`);
    }
  }

  const { data: order } = await sb
    .from('orders')
    .select(
      'stage, has_nfe, has_cte, has_pod, has_cnh, has_crlv, has_antt, has_analise_gr, has_doc_rota, has_vpo'
    )
    .eq('id', order_id as string)
    .maybeSingle();

  if (order) {
    if (
      order.stage === 'documentacao' &&
      order.has_nfe &&
      order.has_cte &&
      order.has_analise_gr &&
      order.has_doc_rota &&
      order.has_vpo
    ) {
      await sb
        .from('orders')
        .update({ stage: 'coleta_realizada' })
        .eq('id', order_id as string);
      actions.push('auto_advanced:coleta_realizada');
    }
    if (order.stage === 'em_transito' && order.has_pod) {
      await sb
        .from('orders')
        .update({ stage: 'entregue' })
        .eq('id', order_id as string);
      actions.push('auto_advanced:entregue');
    }
  }

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Driver Qualified
// ─────────────────────────────────────────────────────

async function handleDriverQualified(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { status } = event.payload;
  const actions: string[] = [];
  const tmap: Record<string, string> = {
    aprovado: 'driver_qualification_approved',
    bloqueado: 'driver_qualification_blocked',
    em_analise: 'driver_qualification_review',
  };
  const tmpl = tmap[status as string];
  if (tmpl) {
    const { data: log } = await sb
      .from('notification_logs')
      .insert({
        template_key: tmpl,
        channel: 'whatsapp',
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (log) await triggerNotificationHub(log.id);
    actions.push(`notification_queued:${tmpl}`);
  }
  if (actions.length === 0) actions.push(`no_action:driver_status_${status}`);
  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Compliance Violation
// ─────────────────────────────────────────────────────

async function handleComplianceViolation(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { check_type, os_number } = event.payload;
  const actions: string[] = [];
  await sb.from('approval_requests').insert({
    entity_type: 'order',
    entity_id: event.entity_id,
    approval_type: 'compliance_override',
    title: `Violação de Compliance - ${os_number || event.entity_id}`,
    description: `Compliance check (${check_type}) encontrou violações que requerem revisão.`,
    assigned_to_role: 'operacao',
    requested_by: event.created_by,
  });
  actions.push('approval_created:compliance_override');
  const { data: log } = await sb
    .from('notification_logs')
    .insert({
      template_key: 'compliance_violation',
      channel: 'both',
      status: 'pending',
      entity_type: 'order',
      entity_id: event.entity_id,
    })
    .select('id')
    .single();
  if (log) await triggerNotificationHub(log.id);
  actions.push('notification_queued:compliance_violation');
  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Deferred: Quote Ganho (24h grace period → cria OS + FAT)
// ─────────────────────────────────────────────────────

async function handleQuoteGanhoDeferred(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const actions: string[] = [];

  const { data: quote } = await sb
    .from('quotes')
    .select('id, stage')
    .eq('id', event.entity_id)
    .single();

  if (!quote) return { success: true, actions: ['skipped:quote_not_found'] };
  if (quote.stage !== 'ganho')
    return { success: true, actions: [`skipped:quote_stage_is_${quote.stage}`] };

  // Idempotência: não cria OS se já existe
  const { data: existingOrder } = await sb
    .from('orders')
    .select('id')
    .eq('quote_id', event.entity_id)
    .maybeSingle();
  if (existingOrder)
    return { success: true, actions: [`skipped:order_already_exists:${existingOrder.id}`] };

  const { data: orderResult, error: orderErr } = await sb.rpc('auto_create_order_from_quote', {
    p_quote_id: event.entity_id,
  });

  if (orderErr) {
    if (orderErr.message.includes('does not exist')) {
      actions.push('skipped:auto_create_order (RPC not yet created)');
    } else {
      throw new Error(`Failed to create order: ${orderErr.message}`);
    }
  } else {
    actions.push(`order_created:${orderResult}`);
    const { error: fatErr } = await sb.rpc('ensure_financial_document', {
      doc_type: 'FAT',
      source_id_in: event.entity_id,
    });
    if (!fatErr) actions.push('fat_created');
  }

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Main: Event Dispatcher
// ─────────────────────────────────────────────────────

async function processEvents(
  sb: SupabaseClient,
  eventId?: string
): Promise<{
  processed: number;
  results: Array<{ eventId: string; event_type: string; result: EventResult }>;
}> {
  const now = new Date().toISOString();
  let query = sb
    .from('workflow_events')
    .select('*')
    .eq('status', 'pending')
    .or(`execute_after.is.null,execute_after.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(20);

  if (eventId) {
    query = sb.from('workflow_events').select('*').eq('id', eventId).eq('status', 'pending');
  }

  const { data: events, error: fetchErr } = await query;
  if (fetchErr) throw new Error(`Failed to fetch events: ${fetchErr.message}`);
  if (!events || events.length === 0) return { processed: 0, results: [] };

  const results: Array<{ eventId: string; event_type: string; result: EventResult }> = [];

  for (const event of events as WorkflowEvent[]) {
    await sb.from('workflow_events').update({ status: 'processing' }).eq('id', event.id);

    try {
      let result: EventResult;

      switch (true) {
        case event.event_type === 'quote.stage_changed':
          result = await handleQuoteStageChanged(sb, event);
          break;
        case event.event_type === 'quote.ganho_deferred':
          result = await handleQuoteGanhoDeferred(sb, event);
          break;
        case event.event_type === 'order.created':
          result = await handleOrderCreated(sb, event);
          break;
        case event.event_type === 'order.stage_changed':
          result = await handleOrderStageChanged(sb, event);
          break;
        case event.event_type === 'financial.status_changed':
          result = await handleFinancialStatusChanged(sb, event);
          break;
        case event.event_type === 'approval.decided':
          result = await handleApprovalDecided(sb, event);
          break;
        case event.event_type === 'document.uploaded':
          result = await handleDocumentUploaded(sb, event);
          break;
        case event.event_type === 'driver.qualified':
          result = await handleDriverQualified(sb, event);
          break;
        case event.event_type === 'compliance.violation':
          result = await handleComplianceViolation(sb, event);
          break;
        default:
          result = { success: true, actions: [`unhandled:${event.event_type}`] };
      }

      await sb
        .from('workflow_events')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', event.id);

      for (const action of result.actions) {
        await logAction(sb, event.id, action, 'workflow-orchestrator');
      }

      results.push({ eventId: event.id, event_type: event.event_type, result });
    } catch (e) {
      const errMsg = (e as Error).message;
      const newRetry = event.retry_count + 1;

      await sb
        .from('workflow_events')
        .update({
          status: newRetry >= event.max_retries ? 'failed' : 'pending',
          retry_count: newRetry,
          error_message: errMsg,
        })
        .eq('id', event.id);

      await logAction(sb, event.id, `error:${errMsg}`, 'workflow-orchestrator', {
        retry_count: newRetry,
      });

      results.push({
        eventId: event.id,
        event_type: event.event_type,
        result: { success: false, actions: [], error: errMsg },
      });
    }
  }

  return { processed: results.length, results };
}

// ─────────────────────────────────────────────────────
// HTTP Handler
// ─────────────────────────────────────────────────────

deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const sb = serviceClient();
    let eventId: string | undefined;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        eventId = body?.eventId;
        if (body?.type === 'INSERT' && body?.record?.id) eventId = body.record.id;
      } catch {
        // empty body ok
      }
    }

    const result = await processEvents(sb, eventId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
