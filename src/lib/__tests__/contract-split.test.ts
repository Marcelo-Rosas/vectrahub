import { describe, expect, it } from 'vitest';
import {
  calculateContractSplit,
  contractSplitsSumCents,
  SplitBasisZeroError,
} from '@/lib/contract-split';

describe('calculateContractSplit', () => {
  it('COT-2026-08-0003 override: Icaro 370000 + Iron 480000 = 850000', () => {
    const result = calculateContractSplit(
      850000,
      [
        {
          sequence: 1,
          party_type: 'client',
          party_id: 'a',
          name: 'ICARO',
          basis_value: 0,
          override_amount_cents: 370000,
        },
        {
          sequence: 2,
          party_type: 'client',
          party_id: 'b',
          name: 'IRON',
          basis_value: 0,
          override_amount_cents: 480000,
        },
      ],
      { isOverride: true }
    );
    expect(result[0]!.amount_cents).toBe(370000);
    expect(result[1]!.amount_cents).toBe(480000);
    expect(contractSplitsSumCents(result)).toBe(850000);
  });

  it('residual no último após sort por sequence', () => {
    const result = calculateContractSplit(10003, [
      { sequence: 2, party_type: 'client', party_id: 'b', name: 'B', basis_value: 50 },
      { sequence: 1, party_type: 'client', party_id: 'a', name: 'A', basis_value: 50 },
    ]);
    expect(result[0]!.sequence).toBe(1);
    expect(result[0]!.amount_cents).toBe(5002);
    expect(result[1]!.amount_cents).toBe(5001);
    expect(contractSplitsSumCents(result)).toBe(10003);
  });

  it('basis zero com 2 pagadores → SplitBasisZeroError', () => {
    expect(() =>
      calculateContractSplit(850000, [
        { sequence: 1, party_type: 'client', party_id: 'a', name: 'A', basis_value: 0 },
        { sequence: 2, party_type: 'client', party_id: 'b', name: 'B', basis_value: 0 },
      ])
    ).toThrow(SplitBasisZeroError);
  });

  it('1 pagador recebe valor total sem exigir basis', () => {
    const result = calculateContractSplit(850000, [
      { sequence: 1, party_type: 'client', party_id: 'a', name: 'A', basis_value: 0 },
    ]);
    expect(result[0]!.amount_cents).toBe(850000);
  });
});
