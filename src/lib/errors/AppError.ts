/**
 * Erro tipado da aplicação (PostgREST, Edge, rede, validação).
 * Use para retry predicado + toast + Sentry context.
 */

export type AppErrorCode =
  | 'AUTH_EXPIRED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'TRANSIENT'
  | 'WORKER_LIMIT'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly name = 'AppError';
  readonly code: AppErrorCode;
  readonly status?: number;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: {
      status?: number;
      cause?: unknown;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.code = code;
    this.status = options?.status;
    this.cause = options?.cause;
    this.context = options?.context;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Retry só para falhas transitórias (5xx / rede / worker limit). */
export function isTransientError(error: unknown): boolean {
  if (isAppError(error)) {
    return (
      error.code === 'TRANSIENT' || error.code === 'WORKER_LIMIT' || error.code === 'RATE_LIMIT'
    );
  }
  if (error && typeof error === 'object') {
    const status =
      (error as { status?: number; statusCode?: number }).status ??
      (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 500) return true;
    if (status === 429) return true;
  }
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /546|WORKER_RESOURCE_LIMIT|network|timeout|fetch failed|ECONNRESET|503|502|504/i.test(msg);
}

/** Mensagem segura pra toast / EmptyState. */
export function toUserMessage(
  error: unknown,
  fallback = 'Erro inesperado. Tente novamente.'
): string {
  if (isAppError(error)) return error.message || fallback;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

/** Classifica status HTTP / mensagens conhecidas → AppError. */
export function mapToAppError(error: unknown, context?: Record<string, unknown>): AppError {
  if (isAppError(error)) {
    return context
      ? new AppError(error.code, error.message, {
          status: error.status,
          cause: error.cause,
          context: { ...error.context, ...context },
        })
      : error;
  }

  const msg = error instanceof Error ? error.message : String(error ?? 'Erro desconhecido');
  const status =
    error && typeof error === 'object'
      ? ((error as { status?: number; statusCode?: number }).status ??
        (error as { statusCode?: number }).statusCode)
      : undefined;

  if (/sessão expirada|jwt|unauthorized|401/i.test(msg) || status === 401) {
    return new AppError('AUTH_EXPIRED', msg || 'Sessão expirada. Faça login novamente.', {
      status: status ?? 401,
      cause: error,
      context,
    });
  }
  if (/forbidden|permiss|403/i.test(msg) || status === 403) {
    return new AppError('FORBIDDEN', msg || 'Sem permissão para esta ação.', {
      status: status ?? 403,
      cause: error,
      context,
    });
  }
  if (/not found|404/i.test(msg) || status === 404) {
    return new AppError('NOT_FOUND', msg || 'Recurso não encontrado.', {
      status: status ?? 404,
      cause: error,
      context,
    });
  }
  if (/429|rate.?limit|too many/i.test(msg) || status === 429) {
    return new AppError('RATE_LIMIT', msg || 'Limite de requisições. Aguarde e tente de novo.', {
      status: status ?? 429,
      cause: error,
      context,
    });
  }
  if (/546|WORKER_RESOURCE_LIMIT/i.test(msg) || status === 546) {
    return new AppError('WORKER_LIMIT', msg || 'Serviço sobrecarregado. Tente novamente.', {
      status: status ?? 546,
      cause: error,
      context,
    });
  }
  if (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 401 &&
    status !== 403 &&
    status !== 404 &&
    status !== 429
  ) {
    return new AppError('VALIDATION', msg, { status, cause: error, context });
  }
  if (status !== undefined && status >= 500) {
    return new AppError('TRANSIENT', msg || 'Falha temporária no servidor.', {
      status,
      cause: error,
      context,
    });
  }
  if (/network|timeout|fetch failed|Failed to fetch|ECONNRESET|502|503|504/i.test(msg)) {
    return new AppError('TRANSIENT', msg || 'Falha de rede. Tente novamente.', {
      status,
      cause: error,
      context,
    });
  }

  return new AppError('UNKNOWN', msg || 'Erro inesperado.', { status, cause: error, context });
}

/** Cap típico PostgREST sem .range() — avisar truncamento silencioso. */
export const POSTGREST_DEFAULT_ROW_CAP = 1000;

export function maybeTruncatedList(rowCount: number): boolean {
  return rowCount >= POSTGREST_DEFAULT_ROW_CAP;
}
