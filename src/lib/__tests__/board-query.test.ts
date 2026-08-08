import { describe, expect, it } from 'vitest';
import { BOARD_STAGE_PAGE_SIZE, fetchRowsByStage } from '@/lib/board-query';

describe('fetchRowsByStage', () => {
  it('merges rows from all stages and flags truncation', async () => {
    const { rows, truncatedStages } = await fetchRowsByStage<{ id: string }>({
      stages: ['a', 'b'],
      pageSize: 2,
      queryKey: 'test',
      fetchStage: async (stage, limit) => {
        if (stage === 'a') {
          return { data: [{ id: 'a1' }, { id: 'a2' }], error: null };
        }
        return { data: [{ id: 'b1' }], error: null };
      },
    });
    expect(rows).toHaveLength(3);
    expect(truncatedStages).toEqual(['a']);
    expect(BOARD_STAGE_PAGE_SIZE).toBe(80);
  });

  it('throws when every stage fails', async () => {
    await expect(
      fetchRowsByStage({
        stages: ['x'],
        queryKey: 'test',
        fetchStage: async () => ({ data: null, error: new Error('boom') }),
      })
    ).rejects.toBeTruthy();
  });
});
