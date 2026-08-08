import { mapToAppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/logger';

/** Max rows per Kanban stage — evita full-table dump PostgREST. */
export const BOARD_STAGE_PAGE_SIZE = 80;

type StageFetchResult<T> = {
  rows: T[];
  truncatedStages: string[];
};

/**
 * Busca em paralelo por stage com limit — payload previsível em escala.
 * Erros por stage são logados; se todos falharem, propaga o primeiro.
 */
export async function fetchRowsByStage<T>(params: {
  stages: readonly string[];
  pageSize?: number;
  queryKey: string;
  fetchStage: (stage: string, limit: number) => Promise<{ data: T[] | null; error: unknown }>;
}): Promise<StageFetchResult<T>> {
  const pageSize = params.pageSize ?? BOARD_STAGE_PAGE_SIZE;
  const results = await Promise.all(
    params.stages.map(async (stage) => {
      const { data, error } = await params.fetchStage(stage, pageSize);
      if (error) {
        const appError = mapToAppError(error, { queryKey: params.queryKey, stage });
        logger.captureException(appError, { queryKey: params.queryKey, stage });
        return { stage, rows: [] as T[], error: appError, truncated: false };
      }
      const rows = data ?? [];
      const truncated = rows.length >= pageSize;
      if (truncated) {
        logger.warn('board stage page may be truncated', {
          queryKey: params.queryKey,
          stage,
          rowCount: rows.length,
          pageSize,
        });
      }
      return { stage, rows, error: null as null, truncated };
    })
  );

  const hardFailures = results.filter((r) => r.error);
  if (hardFailures.length === params.stages.length && hardFailures[0]?.error) {
    throw hardFailures[0].error;
  }

  return {
    rows: results.flatMap((r) => r.rows),
    truncatedStages: results.filter((r) => r.truncated).map((r) => r.stage),
  };
}
