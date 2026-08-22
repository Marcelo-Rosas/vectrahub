import { describe, expect, it } from 'vitest';
import {
  FAIR_LOCKUP_BOX,
  FAIR_LOCKUP_IMG,
  fairHeaderLogoUrl,
  pickFairLockupSrc,
} from '@/lib/fair-lockup';
import { logoSrcForSlug } from '@/lib/fair-tenant';

describe('pickFairLockupSrc', () => {
  it('Rotha e PlayFit usam SVG local — ignora Brandfetch preto', () => {
    expect(
      pickFairLockupSrc({
        slug: 'rotha',
        localSrc: '/brand/rotha-logo.svg',
        apiSrc: 'https://asset.brandfetch.io/rotha-black.png',
        qualityScore: 0.9,
      })
    ).toBe('/brand/rotha-logo.svg');
    expect(
      pickFairLockupSrc({
        slug: 'playfit',
        localSrc: '/brand/playfit-logo.svg',
        apiSrc: 'https://asset.brandfetch.io/playfit.png',
        qualityScore: 0.9,
      })
    ).toBe('/brand/playfit-logo.svg');
  });

  it('Buckler e Konnen também preferem local (mesmo box CSS)', () => {
    expect(
      pickFairLockupSrc({
        slug: 'buckler',
        localSrc: '/brand/buckler-logo.svg',
        apiSrc: 'https://cdn.brandfetch.io/buckler.png',
      })
    ).toBe('/brand/buckler-logo.svg');
    expect(
      pickFairLockupSrc({
        slug: 'konnen',
        localSrc: '/brand/konnen-logo.png',
        apiSrc: 'https://cdn.brandfetch.io/konnen.png',
      })
    ).toBe('/brand/konnen-logo.png');
  });

  it('Rotha não recebe URL Brandfetch no header — PNG preto não entra', () => {
    expect(fairHeaderLogoUrl('rotha', 'https://asset.brandfetch.io/rotha-black.png')).toBeNull();
    expect(fairHeaderLogoUrl('playfit', 'https://cdn.brandfetch.io/x.png')).toBeNull();
    expect(fairHeaderLogoUrl('boost', 'https://cdn.brandfetch.io/boost.png')).toBe(
      'https://cdn.brandfetch.io/boost.png'
    );
  });

  it('Konnen aponta PNG no banner preto (não SVG)', () => {
    expect(logoSrcForSlug('konnen')).toBe('/brand/konnen-logo.png');
    expect(logoSrcForSlug('buckler')).toBe('/brand/buckler-logo.svg');
    expect(logoSrcForSlug('rotha')).toBe('/brand/rotha-logo.svg');
  });

  it('box e img iguais para todos os tenants', () => {
    expect(FAIR_LOCKUP_BOX).toContain('h-10');
    expect(FAIR_LOCKUP_BOX).toContain('w-[13.5rem]');
    expect(FAIR_LOCKUP_BOX).toContain('mx-auto');
    expect(FAIR_LOCKUP_BOX).toContain('justify-center');
    expect(FAIR_LOCKUP_IMG).toContain('h-8');
    expect(FAIR_LOCKUP_IMG).toContain('object-contain');
    expect(FAIR_LOCKUP_IMG).toContain('object-center');
  });
});
