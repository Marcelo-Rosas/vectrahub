export type FairTollMethod = 'table_percent' | 'fallback';

export type FairTollInput = {
  freightWeight: number;
  tableTollPercent: number | null;
  fallbackPercent: number;
};

export type FairTollResult = {
  tollPercent: number;
  pedagio: number;
  method: FairTollMethod;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeFairToll(input: FairTollInput): FairTollResult {
  const useTable = input.tableTollPercent != null && Number.isFinite(input.tableTollPercent);
  const tollPercent = useTable ? Number(input.tableTollPercent) : input.fallbackPercent;
  return {
    tollPercent,
    pedagio: round2(input.freightWeight * (tollPercent / 100)),
    method: useTable ? 'table_percent' : 'fallback',
  };
}
