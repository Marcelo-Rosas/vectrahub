import { describe, expect, it } from 'vitest';
import { ROTHA_FAIR_PALETTE } from '@/lib/fair-brand-palettes';
import {
  isUsableBrandQuality,
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
          formats: [
            {
              src: 'https://asset.brandfetch.io/rotha.svg',
              format: 'svg',
              background: 'transparent',
            },
            {
              src: 'https://asset.brandfetch.io/rotha.png',
              format: 'png',
              background: 'transparent',
              width: 400,
            },
          ],
        },
      ],
    };

    const tokens = mapBrandfetchToFairTokens(payload, ROTHA_FAIR_PALETTE.tokens);
    expect(tokens.accent).toBe('#E10600');
    expect(tokens.ink).toBe('#0D0D0D');
    expect(tokens.pageBg).toBe('#F5F5F5');
    expect(pickBrandfetchLogoUrl(payload.logos, { prefer: 'logo', surfaceIsDark: true })).toBe(
      'https://asset.brandfetch.io/rotha.png'
    );
  });

  it('ignora SVG só na 1ª passa: se não há raster, usa SVG Brandfetch', () => {
    expect(
      pickBrandfetchLogoUrl(
        [
          {
            theme: 'dark',
            type: 'logo',
            formats: [{ src: 'https://asset.brandfetch.io/x.svg', format: 'svg' }],
          },
        ],
        { prefer: 'logo', surfaceIsDark: true }
      )
    ).toBe('https://asset.brandfetch.io/x.svg');
  });

  it('ignora ícone/símbolo quadrado — header precisa de wordmark', () => {
    expect(
      pickBrandfetchLogoUrl(
        [
          {
            theme: 'dark',
            type: 'icon',
            formats: [
              {
                src: 'https://asset.brandfetch.io/icon.png',
                format: 'png',
                width: 128,
                height: 128,
              },
            ],
          },
        ],
        { prefer: 'logo', surfaceIsDark: true }
      )
    ).toBeNull();
  });

  it('Rotha recebe tokens da API; Konnen permanece manual; quality < 0.3 bloqueia', () => {
    expect(shouldApplyApiTokens('rotha', 0.35)).toBe(true);
    expect(shouldApplyApiTokens('konnen', 0.9)).toBe(false);
    expect(isUsableBrandQuality(0.29)).toBe(false);
    expect(isUsableBrandQuality(0.3)).toBe(true);
  });
});
