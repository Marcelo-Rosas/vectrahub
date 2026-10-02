/**
 * Liberação de embarque excepcional (MS Seguros / Fairfax) — regras puras.
 * Paridade obrigatória com src/lib/insurance-exception.ts
 *
 * Apólice RC-DC 6550008359, item 13: embarque acima do LMI → aviso por escrito com
 * 3 dias úteis de antecedência; seguradora responde em até 3 dias úteis; sem resposta
 * no prazo = risco aceito. Sem submissão/aceite → viagem sem cobertura (não averbar).
 * Por isso CT-e e MDF-e ficam bloqueados até a liberação estar vigente.
 */

/**
 * risk_accepted: admin liberou CT-e/MDF-e antes do retorno da MS, assumindo o risco pela VECTRA HUB
 * (sem cobertura do seguro até aceite expresso ou tácito). Não é aceite da seguradora.
 */
export type ExceptionStatus =
  'draft' | 'sent' | 'risk_accepted' | 'accepted' | 'rejected' | 'cancelled';

export type ExceptionRequestRow = {
  id: string;
  status: ExceptionStatus | string;
  quote_ids?: string[] | null;
  cargo_value?: number | string | null;
  sent_at?: string | null;
  response_deadline?: string | null;
  liberation_code?: string | null;
};

export type EffectiveStatus = ExceptionStatus | 'tacit_accepted';

export const RESPONSE_BUSINESS_DAYS = 3;

/** Feriados nacionais fixos (MM-DD). Móveis (Carnaval, Sexta Santa, Corpus) não entram. */
const FIXED_HOLIDAYS = new Set([
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '11-20',
  '12-25',
]);

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

function brtDateParts(d: Date): { y: number; m: number; day: number; dow: number } {
  const local = new Date(d.getTime() + BRT_OFFSET_MS);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    dow: local.getUTCDay(),
  };
}

export function isBusinessDay(d: Date): boolean {
  const { m, day, dow } = brtDateParts(d);
  if (dow === 0 || dow === 6) return false;
  const key = `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return !FIXED_HOLIDAYS.has(key);
}

/**
 * Prazo = fim (23:59:59 BRT) do N-ésimo dia útil após o envio.
 * Envio na sexta → conta seg, ter, qua.
 */
export function responseDeadline(sentAt: Date, businessDays = RESPONSE_BUSINESS_DAYS): Date {
  const { y, m, day } = brtDateParts(sentAt);
  // meia-noite BRT do dia do envio, em UTC
  let cursor = new Date(Date.UTC(y, m - 1, day) - BRT_OFFSET_MS);
  let counted = 0;
  while (counted < businessDays) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (isBusinessDay(cursor)) counted++;
  }
  return new Date(cursor.getTime() + 24 * 60 * 60 * 1000 - 1000);
}

export function effectiveStatus(req: ExceptionRequestRow, now: Date = new Date()): EffectiveStatus {
  const s = String(req.status) as ExceptionStatus;
  // Prazo vencido sem resposta = aceite tácito (com cobertura), inclusive se já liberado por risco assumido.
  if (
    (s === 'sent' || s === 'risk_accepted') &&
    req.response_deadline &&
    now.getTime() > Date.parse(req.response_deadline)
  ) {
    return 'tacit_accepted';
  }
  return s;
}

export function isExceptionGranted(req: ExceptionRequestRow, now: Date = new Date()): boolean {
  const s = effectiveStatus(req, now);
  return s === 'accepted' || s === 'tacit_accepted' || s === 'risk_accepted';
}

/**
 * Liberação vigente que cobre o embarque: contém todas as cotações e valor aprovado ≥ valor atual.
 * Aumento de valor depois da liberação exige novo pedido.
 */
export function findCoveringException(
  requests: ExceptionRequestRow[],
  shipment: { quoteIds: string[]; cargoValue: number },
  now: Date = new Date()
): ExceptionRequestRow | null {
  const need = new Set(shipment.quoteIds.filter(Boolean));
  const value = Number(shipment.cargoValue) || 0;
  for (const req of requests) {
    if (!isExceptionGranted(req, now)) continue;
    const have = new Set(req.quote_ids ?? []);
    if (need.size === 0 || [...need].some((q) => !have.has(q))) continue;
    if ((Number(req.cargo_value) || 0) + 0.005 < value) continue;
    return req;
  }
  return null;
}

export type GateInput = {
  limitOk: boolean;
  limit: number;
  limitLabel: string;
  cargoValue: number;
  quoteIds: string[];
  requests: ExceptionRequestRow[];
  now?: Date;
};

export type GateResult =
  | { allowed: true; exception: ExceptionRequestRow | null }
  | {
      allowed: false;
      error: 'insurance_exception_required' | 'insurance_exception_pending';
      detail: string;
      pending: ExceptionRequestRow | null;
    };

function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function evaluateEmissionGate(input: GateInput): GateResult {
  if (input.limitOk) return { allowed: true, exception: null };
  const now = input.now ?? new Date();
  const covering = findCoveringException(
    input.requests,
    { quoteIds: input.quoteIds, cargoValue: input.cargoValue },
    now
  );
  if (covering) return { allowed: true, exception: covering };

  const pending =
    input.requests.find((r) => {
      const s = effectiveStatus(r, now);
      return (
        (s === 'sent' || s === 'draft') &&
        input.quoteIds.every((q) => (r.quote_ids ?? []).includes(q))
      );
    }) ?? null;
  const base = `Valor da carga ${brl(input.cargoValue)} excede ${input.limitLabel}. Emissão bloqueada até liberação excepcional da MS/Fairfax.`;
  // Liberação vigente para as mesmas cotações, mas com valor menor que a carga atual.
  const undervalued =
    input.requests.find(
      (r) =>
        isExceptionGranted(r, now) && input.quoteIds.every((q) => (r.quote_ids ?? []).includes(q))
    ) ?? null;
  if (undervalued) {
    return {
      allowed: false,
      error: 'insurance_exception_pending',
      detail: `${base} A liberação vigente (${effectiveStatus(undervalued, now)}) cobre só até ${brl(Number(undervalued.cargo_value) || 0)}. Reenvie o pedido em Risco → Reenviar com o valor atual da carga.`,
      pending: undervalued,
    };
  }
  if (pending) {
    const prazo = pending.response_deadline
      ? ` Aceite tácito após ${new Date(pending.response_deadline).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`
      : ' Pedido ainda não enviado.';
    return {
      allowed: false,
      error: 'insurance_exception_pending',
      detail: `${base} Pedido em andamento (${pending.status}).${prazo}`,
      pending,
    };
  }
  return {
    allowed: false,
    error: 'insurance_exception_required',
    detail: `${base} Solicite em Risco → Liberação excepcional.`,
    pending: null,
  };
}
