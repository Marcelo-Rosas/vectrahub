import { describe, expect, it } from 'vitest';
import { buildMdfeRef, mdfeRefAmbienteTag } from '../mdfe-mapper.ts';

describe('buildMdfeRef', () => {
  it('prefixa ambiente no ref (homolog H, prod P)', () => {
    expect(buildMdfeRef(1, 13, 0, 'homolog')).toBe('CFN-MDFE-H-1-13');
    expect(buildMdfeRef(1, 13, 0, 'prod')).toBe('CFN-MDFE-P-1-13');
    expect(buildMdfeRef(1, 6, 1, 'prod')).toBe('CFN-MDFE-P-1-6-r1');
  });

  it('mdfeRefAmbienteTag', () => {
    expect(mdfeRefAmbienteTag('prod')).toBe('P');
    expect(mdfeRefAmbienteTag('homolog')).toBe('H');
  });
});
