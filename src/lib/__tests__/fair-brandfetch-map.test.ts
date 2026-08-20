import { describe, expect, it } from 'vitest';
import { ROTHA_FAIR_PALETTE } from '@/lib/fair-brand-palettes';
import {
  mapBrandfetchToFairTokens,
  pickBrandfetchLogoUrl,
  shouldApplyApiTokens,
  type BrandfetchBrandPayload,
} from '@/lib/fair-brandfetch-map';

describe('fair-brandfetch-map', () => {
  it('mapeia cores Brandfetch para tokens Rotha', () => {
    const payload: BrandfetchBrandPayload = {
      name: 'Rotha Fitness',
      domain: 'rothafitness.com',
      qualityScore: 0.42,
      colors: [
        { hex: '#E10600', type: 'accent' },
        { hex: '#0D0D0D', type: 'dark' },
        { hex: '#F5F5F5', type: 'light' },
      ],
      logos: [
        {
          theme: 'dark',
          type: 'logo',
          formats: [{ src: 'https://asset.brandfetch.io/rotha.svg', format: 'svg' }],
        },
      ],
    };

    const tokens = mapBrandfetchToFairTokens(payload, ROTHA_FAIR_PALETTE.tokens);
    expect(tokens.accent).toBe('#E10600');
    expect(tokens.ink).toBe('#0D0D0D');
    expect(tokens.pageBg).toBe('#F5F5F5');
    expect(pickBrandfetchLogoUrl(payload.logos)).toBe('https://asset.brandfetch.io/rotha.svg');
  });

  it('Rotha recebe tokens da API; Konnen permanece manual', () => {
    expect(shouldApplyApiTokens('rotha', 0.35)).toBe(true);
    expect(shouldApplyApiTokens('konnen', 0.9)).toBe(false);
  });
});
