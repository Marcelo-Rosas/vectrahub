import { describe, expect, it } from 'vitest';
import { getCorsHeaders } from '../../../supabase/functions/_shared/cors';
import { CARGO_APP_ORIGIN, FAIR_APP_ORIGIN, HUB_APP_ORIGIN } from '@/lib/tenancy';

function req(headers: Record<string, string>): Request {
  return new Request('https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight', {
    method: 'OPTIONS',
    headers,
  });
}

describe('getCorsHeaders — Hub comercial preflight', () => {
  it('echoes Hub origin on Access-Control-Allow-Origin', () => {
    const headers = getCorsHeaders(req({ Origin: HUB_APP_ORIGIN }));
    expect(headers['Access-Control-Allow-Origin']).toBe(HUB_APP_ORIGIN);
  });

  it('echoes Feira origin on Access-Control-Allow-Origin', () => {
    const headers = getCorsHeaders(req({ Origin: FAIR_APP_ORIGIN }));
    expect(headers['Access-Control-Allow-Origin']).toBe(FAIR_APP_ORIGIN);
  });

  it('does not allow Cargo origin', () => {
    const headers = getCorsHeaders(req({ Origin: CARGO_APP_ORIGIN }));
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('normalizes trailing slash on Hub origin', () => {
    const headers = getCorsHeaders(req({ Origin: `${HUB_APP_ORIGIN}/` }));
    expect(headers['Access-Control-Allow-Origin']).toBe(HUB_APP_ORIGIN);
  });

  it('falls back to Referer origin when Origin is stripped', () => {
    const headers = getCorsHeaders(req({ Referer: `${HUB_APP_ORIGIN}/comercial` }));
    expect(headers['Access-Control-Allow-Origin']).toBe(HUB_APP_ORIGIN);
  });

  it('does not allow Cargo via Referer when Origin is stripped', () => {
    const headers = getCorsHeaders(req({ Referer: `${CARGO_APP_ORIGIN}/comercial` }));
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('defaults to Hub origin when gateway forwards neither Origin nor Referer', () => {
    const headers = getCorsHeaders(req({}));
    expect(headers['Access-Control-Allow-Origin']).toBe(HUB_APP_ORIGIN);
  });

  it('allows supabase-js preflight header x-supabase-api-version', () => {
    const headers = getCorsHeaders(req({ Origin: HUB_APP_ORIGIN }));
    expect(headers['Access-Control-Allow-Headers'].toLowerCase()).toContain(
      'x-supabase-api-version'
    );
  });
});
