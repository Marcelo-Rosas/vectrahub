import { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ✅ ESM-safe (sem __dirname)
const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const SUPABASE_PREFIX = '/rest/v1';
const FUNCTIONS_PREFIX = '/functions/v1';
const AUTH_PREFIX = '/auth/v1';

// ---------------------------------------------------------------------------
// Supabase fake-session injection (for mock-only tests without storageState)
// ---------------------------------------------------------------------------

/** Supabase project ref — used to build the localStorage key. */
const SUPABASE_PROJECT_REF = 'lrbtbrpoklgwaaclbufz';

/**
 * Creates a minimal fake JWT that Supabase JS v2 can decode without
 * signature validation (the client never verifies the signature).
 */
function createFakeJwt(payload: object): string {
  const toBase64Url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' });
  const body = toBase64Url(payload);
  return `${header}.${body}.fake-e2e-signature`;
}

const E2E_USER_ID = 'e2e-user-00000000-0000-0000-0000-000000000001';

/**
 * Injects a valid-looking (non-expired) Supabase session into localStorage
 * before the page initializes, so the app sees an authenticated user without
 * needing a real `.auth/user.json` storageState.
 *
 * Must be called BEFORE `page.goto(...)`.
 */
export async function injectFakeSession(page: Page) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + 86400; // 24h from now — won't trigger auto-refresh

  const accessToken = createFakeJwt({
    sub: E2E_USER_ID,
    email: 'e2e@local.test',
    aud: 'authenticated',
    role: 'authenticated',
    iss: `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1`,
    exp: expiresAt,
    iat: nowSec,
  });

  const session = {
    access_token: accessToken,
    refresh_token: 'fake-e2e-refresh-token',
    expires_in: 86400,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: E2E_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e@local.test',
      email_confirmed_at: '2026-01-01T00:00:00Z',
      phone: '',
      confirmed_at: '2026-01-01T00:00:00Z',
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    },
  };

  const lsKey = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: lsKey, value: JSON.stringify(session) }
  );
}

const BASE_HEADERS = {
  'Content-Type': 'application/json',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,apikey',
};

export const loadFixture = (fileName: string) =>
  JSON.parse(readFileSync(path.join(fixturesDir, fileName), 'utf8'));

const clone = (payload: unknown) => JSON.parse(JSON.stringify(payload));
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fulfillJson = async (
  route: Route,
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
) => {
  await route.fulfill({
    status,
    headers: {
      ...BASE_HEADERS,
      ...extraHeaders,
    },
    body: JSON.stringify(clone(data)),
  });
};

const respondToOptions = async (route: Route) => {
  await route.fulfill({
    status: 204,
    headers: {
      ...CORS_HEADERS,
      ...BASE_HEADERS,
    },
  });
};

const acceptsObjectResponse = (route: Route) => {
  const header = route.request().headers()['accept'] ?? '';
  return header.includes('application/vnd.pgrst.object+json');
};

const toArrayPayload = (payload: unknown) => {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  return [payload];
};

const toObjectPayload = (payload: unknown) => {
  if (payload == null) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  return payload;
};

const respondWithPayload = async (route: Route, payload: unknown, wantsObject: boolean) => {
  if (wantsObject) {
    await fulfillJson(route, toObjectPayload(payload));
    return;
  }
  await fulfillJson(route, toArrayPayload(payload));
};

const matchesTable = (route: Route, table: string) => {
  const url = new URL(route.request().url());
  return url.pathname === `${SUPABASE_PREFIX}/${table}`;
};
export async function mockStaticRoute(page: Page, table: string, data: unknown) {
  await page.route(`**${SUPABASE_PREFIX}/${table}**`, async (route) => {
    if (!matchesTable(route, table)) {
      await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
      return;
    }
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    if (route.request().method() !== 'GET') {
      await fulfillJson(route, buildFallbackBody(route), 405, CORS_HEADERS);
      return;
    }
    const wantsObject = acceptsObjectResponse(route);
    await respondWithPayload(route, data, wantsObject);
  });
}

interface MockQuotesOptions {
  delayPostMs?: number;
}

export async function mockQuotesRoute(
  page: Page,
  quotes: unknown[],
  updateResponse?: unknown,
  createResponse?: unknown,
  options?: MockQuotesOptions
) {
  await page.route(`**${SUPABASE_PREFIX}/quotes**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== `${SUPABASE_PREFIX}/quotes`) {
      await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
      return;
    }
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    const method = route.request().method();
    const wantsObject = acceptsObjectResponse(route);
    const idParam = url.searchParams.get('id');
    const filtered = idParam?.startsWith('eq.')
      ? (quotes as { id: string }[]).filter((item) => item.id === idParam.replace('eq.', ''))
      : quotes;

    if (method === 'GET') {
      await respondWithPayload(route, filtered, wantsObject);
      return;
    }

    if (method === 'PATCH') {
      if (updateResponse) {
        await respondWithPayload(route, updateResponse, wantsObject);
        return;
      }
      await fulfillJson(route, buildFallbackBody(route), 405, CORS_HEADERS);
      return;
    }

    if (method === 'POST') {
      if (options?.delayPostMs) {
        await delay(options.delayPostMs);
      }
      if (createResponse) {
        const wantsObject = acceptsObjectResponse(route);
        await respondWithPayload(route, createResponse, wantsObject);
        return;
      }
      await fulfillJson(route, buildFallbackBody(route), 405, CORS_HEADERS);
      return;
    }

    await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
  });
}

interface PaymentTermsMockConfig {
  list: unknown[];
  advanceFixtures: Record<number, unknown>;
  delayFirstAdvancePercent?: number;
  delayFirstMs?: number;
}

export async function mockPaymentTermsRoute(page: Page, config: PaymentTermsMockConfig) {
  const path = `${SUPABASE_PREFIX}/payment_terms`;
  let didDelayAdvance = false;
  await page.route(`**${path}**`, async (route) => {
    if (!matchesTable(route, 'payment_terms')) {
      await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
      return;
    }
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    if (route.request().method() !== 'GET') {
      await fulfillJson(route, buildFallbackBody(route), 405, CORS_HEADERS);
      return;
    }

    const url = new URL(route.request().url());
    const advanceParam = url.searchParams.get('advance_percent');
    const idParam = url.searchParams.get('id');
    const wantsObject = acceptsObjectResponse(route);
    let rows: unknown[] = config.list;

    if (advanceParam && advanceParam.startsWith('eq.')) {
      const percent = Number(advanceParam.replace('eq.', ''));
      if (config.delayFirstAdvancePercent === percent && !didDelayAdvance && config.delayFirstMs) {
        didDelayAdvance = true;
        await delay(config.delayFirstMs);
      }
      rows =
        (config.advanceFixtures[percent] != null
          ? (config.advanceFixtures[percent] as unknown[])
          : config.list) || [];
    } else if (idParam && idParam.startsWith('eq.')) {
      const targetId = idParam.replace('eq.', '');
      rows = (config.list as { id: string }[]).filter((row) => row.id === targetId);
    }

    await respondWithPayload(route, rows, wantsObject);
  });
}

/** user_profile enum: admin | operacional | financeiro | comercial (or admin | operacional | financeiro in older types) */
export type UserProfile = 'admin' | 'operacional' | 'financeiro' | 'comercial';

const RPC_PROFILE_PATH = `${SUPABASE_PREFIX}/rpc/current_user_profile`;

export async function mockCurrentUserProfileRoute(
  page: Page,
  profile: UserProfile = 'operacional'
) {
  await page.route(`**${RPC_PROFILE_PATH}**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== RPC_PROFILE_PATH) {
      await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
      return;
    }
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, buildFallbackBody(route), 405, CORS_HEADERS);
      return;
    }
    await fulfillJson(route, profile, 200, CORS_HEADERS);
  });
}

const E2E_USER = {
  id: 'e2e-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@local.test',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: new Date().toISOString(),
  is_anonymous: false,
};

const E2E_SESSION = {
  access_token: 'fake-e2e-access-token',
  token_type: 'bearer',
  refresh_token: 'fake-e2e-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: E2E_USER,
};

export async function mockAuthUserRoute(page: Page) {
  await page.route(`**${AUTH_PREFIX}/user**`, async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/user')) {
      await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
      return;
    }
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    if (route.request().method() !== 'GET') {
      await fulfillJson(route, buildFallbackBody(route), 405, CORS_HEADERS);
      return;
    }
    await fulfillJson(route, E2E_USER, 200, CORS_HEADERS);
  });

  await page.route(`**${AUTH_PREFIX}/token**`, async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/token')) {
      await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
      return;
    }
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, buildFallbackBody(route), 405, CORS_HEADERS);
      return;
    }
    await fulfillJson(route, E2E_SESSION, 200, CORS_HEADERS);
  });
}

function buildFallbackBody(route: Route) {
  const url = new URL(route.request().url());
  return {
    error: 'UNMOCKED_REQUEST',
    method: route.request().method(),
    pathname: url.pathname,
    search: url.search,
  };
}

async function handleFallbackRequest(route: Route) {
  await fulfillJson(route, buildFallbackBody(route), 501, CORS_HEADERS);
}

export async function registerFallbackRoutes(page: Page) {
  await page.route(`**${SUPABASE_PREFIX}/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    await handleFallbackRequest(route);
  });
  await page.route(`**${FUNCTIONS_PREFIX}/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    await handleFallbackRequest(route);
  });
  await page.route(`**${AUTH_PREFIX}/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await respondToOptions(route);
      return;
    }
    await handleFallbackRequest(route);
  });
}
