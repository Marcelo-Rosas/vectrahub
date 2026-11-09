import { describe, expect, it } from 'vitest';
import {
  CARGO_APP_ORIGIN,
  CARGO_PAGES_PROJECT,
  CARGO_SUPABASE_REF,
  FAIR_APP_ORIGIN,
  HUB_APP_ORIGIN,
  HUB_PAGES_PROJECT,
  HUB_SUPABASE_REF,
  HUB_SUPABASE_URL,
} from '@/lib/tenancy';

describe('tenancy — isolamento Hub ≠ Cargo', () => {
  it('Hub e Cargo têm refs e hosts distintos', () => {
    expect(HUB_SUPABASE_REF).toBe('lrbtbrpoklgwaaclbufz');
    expect(CARGO_SUPABASE_REF).toBe('epgedaiukjippepujuzc');
    expect(HUB_SUPABASE_REF).not.toBe(CARGO_SUPABASE_REF);
    expect(HUB_APP_ORIGIN).toBe('https://app.hub.vectracargo.com.br');
    expect(CARGO_APP_ORIGIN).toBe('https://app.vectracargo.com.br');
    expect(HUB_APP_ORIGIN).not.toBe(CARGO_APP_ORIGIN);
    expect(FAIR_APP_ORIGIN).toBe('https://app.feira.vectracargo.com.br');
  });

  it('URL Hub contém só o ref Hub', () => {
    expect(HUB_SUPABASE_URL).toContain(HUB_SUPABASE_REF);
    expect(HUB_SUPABASE_URL).not.toContain(CARGO_SUPABASE_REF);
  });

  it('Pages Hub ≠ Pages Cargo', () => {
    expect(HUB_PAGES_PROJECT).toBe('vectrahub');
    expect(CARGO_PAGES_PROJECT).toBe('cargo-flow-navigator');
    expect(HUB_PAGES_PROJECT).not.toBe(CARGO_PAGES_PROJECT);
  });
});
