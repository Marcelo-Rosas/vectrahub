-- RPC: get_dashboard_kpi — agrega KPIs do dashboard em 1 round-trip.
-- SECURITY INVOKER: respeita RLS do caller (authenticated).

CREATE OR REPLACE FUNCTION public.get_dashboard_kpi()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_tz text := 'America/Sao_Paulo';
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_cur_start timestamptz;
  v_cur_end timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_six_months_ago timestamptz;

  v_pipeline_value numeric := 0;
  v_total_quotes bigint := 0;
  v_won_quotes bigint := 0;
  v_conversion_rate numeric := 0;

  v_cur_pipeline numeric := 0;
  v_prev_pipeline numeric := 0;
  v_pipeline_trend jsonb := null;

  v_cur_total bigint := 0;
  v_cur_won bigint := 0;
  v_prev_total bigint := 0;
  v_prev_won bigint := 0;
  v_cur_conv numeric := 0;
  v_prev_conv numeric := 0;
  v_conversion_trend jsonb := null;

  v_active_orders bigint := 0;
  v_deliveries_today bigint := 0;
  v_pending_docs bigint := 0;
  v_critical_alerts bigint := 0;

  v_conversion_chart jsonb := '[]'::jsonb;
  v_revenue_by_client jsonb := '[]'::jsonb;
BEGIN
  v_today_start := date_trunc('day', v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_today_end := v_today_start + interval '1 day';

  v_cur_start := date_trunc('month', v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_cur_end := (date_trunc('month', v_now AT TIME ZONE v_tz) + interval '1 month') AT TIME ZONE v_tz;
  v_prev_start := (date_trunc('month', v_now AT TIME ZONE v_tz) - interval '1 month') AT TIME ZONE v_tz;
  v_prev_end := v_cur_start;
  v_six_months_ago := (date_trunc('month', v_now AT TIME ZONE v_tz) - interval '5 months') AT TIME ZONE v_tz;

  -- Pipeline aberto (não ganho/perdido)
  SELECT coalesce(sum(q.value), 0)
  INTO v_pipeline_value
  FROM public.quotes q
  WHERE q.stage NOT IN ('ganho', 'perdido');

  -- Conversão all-time
  SELECT count(*), count(*) FILTER (WHERE q.stage = 'ganho')
  INTO v_total_quotes, v_won_quotes
  FROM public.quotes q;

  v_conversion_rate := CASE
    WHEN v_total_quotes > 0 THEN round((v_won_quotes::numeric / v_total_quotes::numeric) * 100)
    ELSE 0
  END;

  -- Pipeline mês atual vs anterior (quotes abertas criadas no mês)
  SELECT coalesce(sum(q.value), 0)
  INTO v_cur_pipeline
  FROM public.quotes q
  WHERE q.created_at >= v_cur_start
    AND q.created_at < v_cur_end
    AND q.stage NOT IN ('ganho', 'perdido');

  SELECT coalesce(sum(q.value), 0)
  INTO v_prev_pipeline
  FROM public.quotes q
  WHERE q.created_at >= v_prev_start
    AND q.created_at < v_prev_end
    AND q.stage NOT IN ('ganho', 'perdido');

  IF v_prev_pipeline > 0 THEN
    v_pipeline_trend := jsonb_build_object(
      'value', abs(round(((v_cur_pipeline - v_prev_pipeline) / v_prev_pipeline) * 100)),
      'isPositive', (v_cur_pipeline - v_prev_pipeline) >= 0
    );
  END IF;

  -- Conversão mês atual vs anterior
  SELECT
    count(*),
    count(*) FILTER (WHERE q.stage = 'ganho')
  INTO v_cur_total, v_cur_won
  FROM public.quotes q
  WHERE q.created_at >= v_cur_start AND q.created_at < v_cur_end;

  SELECT
    count(*),
    count(*) FILTER (WHERE q.stage = 'ganho')
  INTO v_prev_total, v_prev_won
  FROM public.quotes q
  WHERE q.created_at >= v_prev_start AND q.created_at < v_prev_end;

  v_cur_conv := CASE WHEN v_cur_total > 0 THEN (v_cur_won::numeric / v_cur_total::numeric) * 100 ELSE 0 END;
  v_prev_conv := CASE WHEN v_prev_total > 0 THEN (v_prev_won::numeric / v_prev_total::numeric) * 100 ELSE 0 END;

  IF v_prev_total > 0 AND v_cur_total > 0 THEN
    v_conversion_trend := jsonb_build_object(
      'value', abs(round(
        CASE WHEN v_prev_conv > 0 THEN ((v_cur_conv - v_prev_conv) / v_prev_conv) * 100 ELSE 0 END
      )),
      'isPositive', (v_cur_conv - v_prev_conv) >= 0
    );
  END IF;

  -- OS ativas
  SELECT count(*)
  INTO v_active_orders
  FROM public.orders o
  WHERE o.stage IS DISTINCT FROM 'entregue';

  -- Entregas previstas hoje (ETA)
  SELECT count(*)
  INTO v_deliveries_today
  FROM public.orders o
  WHERE o.eta >= v_today_start AND o.eta < v_today_end;

  -- Docs pendentes em OS abertas (espelha filtro client: has_* = false)
  SELECT count(*)
  INTO v_pending_docs
  FROM public.orders o
  WHERE o.stage IS DISTINCT FROM 'entregue'
    AND (o.has_nfe = false OR o.has_cte = false OR o.has_pod = false);

  -- Alertas críticos
  SELECT count(*)
  INTO v_critical_alerts
  FROM public.occurrences oc
  WHERE oc.severity = 'critica' AND oc.resolved_at IS NULL;

  -- Chart conversão últimos 6 meses (rótulo pt-BR curto)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'name',
        (ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[
          extract(month FROM m.month_start AT TIME ZONE v_tz)::int
        ]
        || ' '
        || to_char(m.month_start AT TIME ZONE v_tz, 'YY'),
      'value', CASE
        WHEN m.total_count > 0 THEN round((m.won_count::numeric / m.total_count::numeric) * 100)
        ELSE 0
      END
    )
    ORDER BY m.month_start
  ), '[]'::jsonb)
  INTO v_conversion_chart
  FROM (
    SELECT
      gs AS month_start,
      count(q.id) AS total_count,
      count(q.id) FILTER (WHERE q.stage = 'ganho') AS won_count
    FROM generate_series(v_six_months_ago, v_cur_start, interval '1 month') AS gs
    LEFT JOIN public.quotes q
      ON q.created_at >= gs
     AND q.created_at < gs + interval '1 month'
    GROUP BY gs
  ) m;

  -- Top 5 receita por cliente (OS entregues)
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_revenue_by_client
  FROM (
    SELECT
      coalesce(nullif(trim(o.client_name), ''), 'Sem cliente') AS name,
      sum(o.value)::numeric AS value
    FROM public.orders o
    WHERE o.stage = 'entregue'
    GROUP BY 1
    ORDER BY value DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'pipelineValue', v_pipeline_value,
    'conversionRate', v_conversion_rate,
    'activeOrders', v_active_orders,
    'deliveriesToday', v_deliveries_today,
    'pendingDocuments', v_pending_docs,
    'criticalAlerts', v_critical_alerts,
    'pipelineTrend', v_pipeline_trend,
    'conversionTrend', v_conversion_trend,
    'conversionChart', v_conversion_chart,
    'revenueByClient', v_revenue_by_client
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_kpi() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpi() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpi() TO service_role;

COMMENT ON FUNCTION public.get_dashboard_kpi() IS
  'KPIs + charts leves do Dashboard (1 round-trip). SECURITY INVOKER + RLS.';
