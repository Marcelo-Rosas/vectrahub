import { useCallback, useState } from 'react';
import { nextQuoteOutcome } from '@/lib/fair-dashboard-kpis';
import type { FairQuoteOutcome } from '@/lib/fair-dashboard-types';

const STORAGE_KEY = 'feira-quote-outcomes';

function loadOutcomes(): Record<string, FairQuoteOutcome> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const allowed = new Set(['open', 'won', 'lost']);
    const out: Record<string, FairQuoteOutcome> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && allowed.has(value)) {
        out[id] = value as FairQuoteOutcome;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persist(map: Record<string, FairQuoteOutcome>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Persistência local de ganho/perdido até Edge `feira-quotes-feed` existir. */
export function useFairQuoteOutcomes() {
  const [outcomes, setOutcomes] = useState<Record<string, FairQuoteOutcome>>(loadOutcomes);

  const setQuoteOutcome = useCallback((id: string, clicked: 'won' | 'lost') => {
    setOutcomes((prev) => {
      const current = prev[id] ?? 'open';
      const next = nextQuoteOutcome(current, clicked);
      const merged = { ...prev, [id]: next };
      persist(merged);
      return merged;
    });
  }, []);

  return { outcomes, setQuoteOutcome };
}
