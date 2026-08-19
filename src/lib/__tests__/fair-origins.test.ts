import { describe, expect, it } from 'vitest';
import { FAIR_APP_HOME, FAIR_APP_ORIGIN, isFairHostname } from '@/lib/fair-origins';

describe('fair-origins', () => {
  it('marca host feira e aponta URL do app', () => {
    expect(isFairHostname('app.feira.vectracargo.com.br')).toBe(true);
    expect(isFairHostname('app.hub.vectracargo.com.br')).toBe(false);
    expect(FAIR_APP_HOME).toBe(`${FAIR_APP_ORIGIN}/feira`);
  });
});
