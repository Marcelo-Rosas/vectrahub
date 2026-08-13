import { supabase } from '@/integrations/supabase/client';
import { AppError, mapToAppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/logger';

type InvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getPublishableKey(): string | undefined {
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

function fail(error: unknown, functionName: string, extra?: Record<string, unknown>): never {
  const appError = mapToAppError(error, { functionName, ...extra });
  logger.captureException(appError, {
    functionName,
    code: appError.code,
    status: appError.status,
    ...extra,
  });
  throw appError;
}

async function buildAuthHeaders(requireAuth: boolean): Promise<Record<string, string>> {
  const baseHeaders: Record<string, string> = {};
  const publishableKey = getPublishableKey();
  if (publishableKey) {
    baseHeaders.apikey = publishableKey;
  }

  // getUser() forces refresh if token expired; getSession() alone can return stale token
  await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    if (requireAuth) {
      throw new AppError('AUTH_EXPIRED', 'Sessão expirada. Faça login novamente e tente de novo.', {
        status: 401,
      });
    }
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function parseErrorContext(error: { context?: Response }): Promise<string | null> {
  const context = error?.context;
  if (!context) return null;
  const contentType = context.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await context.clone().json()) as {
        error?: string;
        detail?: string;
        message?: string;
        errors?: string[];
      };
      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        return payload.errors.join('; ');
      }
      return payload?.detail || payload?.message || payload?.error || null;
    } catch {
      try {
        const text = await context.clone().text();
        return text || null;
      } catch {
        return null;
      }
    }
  }
  try {
    const text = await context.clone().text();
    return text?.slice(0, 200) || null;
  } catch {
    return null;
  }
}

function statusFromFunctionsError(error: {
  message?: string;
  context?: Response;
}): number | undefined {
  const ctxStatus = error.context?.status;
  if (typeof ctxStatus === 'number') return ctxStatus;
  const m = error.message?.match(/\b([45]\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<T> {
  try {
    const requireAuth = options.requireAuth ?? true;
    const initialHeaders = await buildAuthHeaders(requireAuth);

    // API Key para chamadas sem sessão (crons, integrações externas)
    const cfnApiKey = import.meta.env.VITE_CFN_API_KEY;
    if (cfnApiKey && typeof cfnApiKey === 'string') {
      initialHeaders['x-api-key'] = cfnApiKey;
    }

    const execute = (headers: Record<string, string>) =>
      supabase.functions.invoke(functionName, {
        body: options.body as Record<string, unknown> | undefined,
        headers: {
          ...(options.headers ?? {}),
          ...headers,
        },
      });

    let { data, error } = await execute(initialHeaders);

    // Supabase can return 546/WORKER_RESOURCE_LIMIT before function-level fallback.
    // Retry once with small backoff for transient runtime pressure.
    if (error && /546|WORKER_RESOURCE_LIMIT/i.test(error.message || '')) {
      await sleep(350);
      const retryResourceLimit = await execute(initialHeaders);
      data = retryResourceLimit.data;
      error = retryResourceLimit.error;
    }

    if (error && /401|jwt|token/i.test(error.message || '')) {
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (!refreshError && refreshedSession?.access_token) {
        const retryHeaders: Record<string, string> = {
          ...initialHeaders,
          Authorization: `Bearer ${refreshedSession.access_token}`,
        };
        const retry = await execute(retryHeaders);
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      // Fallback: in rare browser/client-sdk cases, invoke can return 401 even with
      // valid headers. Retry with direct HTTP call to eliminate SDK transport issues.
      if (/401|jwt|token|authorization/i.test(error.message || '')) {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const publishableKey = getPublishableKey();
        if (url && publishableKey) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const accessToken = session?.access_token;
          if (accessToken) {
            const directRes = await fetch(`${url}/functions/v1/${functionName}`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                apikey: publishableKey,
                Authorization: `Bearer ${accessToken}`,
                ...(options.headers ?? {}),
              },
              body: options.body != null ? JSON.stringify(options.body) : undefined,
            });

            if (directRes.ok) {
              const payload = (await directRes.json()) as T;
              return payload;
            }

            const contentType = directRes.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              try {
                const payload = (await directRes.json()) as {
                  error?: string;
                  message?: string;
                  errors?: string[];
                };
                const message =
                  (Array.isArray(payload?.errors) && payload.errors.length > 0
                    ? payload.errors.join('; ')
                    : null) ||
                  payload?.error ||
                  payload?.message ||
                  `HTTP ${directRes.status}`;
                fail(
                  new AppError(
                    directRes.status === 401
                      ? 'AUTH_EXPIRED'
                      : directRes.status >= 500
                        ? 'TRANSIENT'
                        : 'VALIDATION',
                    message,
                    { status: directRes.status }
                  ),
                  functionName,
                  { transport: 'direct-fetch' }
                );
              } catch (parseErr) {
                const text = await directRes.text().catch(() => null);
                fail(
                  new AppError(
                    directRes.status >= 500 ? 'TRANSIENT' : 'UNKNOWN',
                    text || `HTTP ${directRes.status}`,
                    { status: directRes.status, cause: parseErr }
                  ),
                  functionName,
                  { transport: 'direct-fetch' }
                );
              }
            } else {
              const text = await directRes.text().catch(() => null);
              fail(
                new AppError(
                  directRes.status >= 500 ? 'TRANSIENT' : 'UNKNOWN',
                  text
                    ? `HTTP ${directRes.status}: ${text.slice(0, 200)}`
                    : `HTTP ${directRes.status}: ${directRes.statusText}`,
                  { status: directRes.status }
                ),
                functionName,
                { transport: 'direct-fetch' }
              );
            }
          }
        }
      }

      const parsedMessage = await parseErrorContext(error as { context?: Response });
      const status = statusFromFunctionsError(error as { message?: string; context?: Response });
      fail(
        new AppError(
          status === 401
            ? 'AUTH_EXPIRED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 404
                ? 'NOT_FOUND'
                : status === 429
                  ? 'RATE_LIMIT'
                  : status === 546 || /546|WORKER_RESOURCE_LIMIT/i.test(error.message || '')
                    ? 'WORKER_LIMIT'
                    : status !== undefined && status >= 500
                      ? 'TRANSIENT'
                      : status !== undefined && status >= 400
                        ? 'VALIDATION'
                        : 'UNKNOWN',
          parsedMessage || error.message || 'Falha ao chamar função',
          { status, cause: error }
        ),
        functionName
      );
    }

    // Business error embedded in 2xx body (legacy pattern)
    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      (data as { error?: unknown }).error
    ) {
      const embedded = String((data as { error: unknown }).error);
      fail(new AppError('VALIDATION', embedded, { status: 400 }), functionName, {
        embeddedBodyError: true,
      });
    }

    return data as T;
  } catch (err) {
    if (err instanceof AppError) {
      // fail() already logged with functionName in context; auth throws may not
      if (!err.context?.functionName) {
        logger.captureException(err, {
          functionName,
          code: err.code,
          status: err.status,
          ...err.context,
        });
      }
      throw err;
    }
    fail(err, functionName);
  }
}
