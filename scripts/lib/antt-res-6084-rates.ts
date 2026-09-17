import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AnttFloorRateInsert {
  operation_table: string;
  cargo_type: string;
  axes_count: number;
  ccd: number;
  cc: number;
  valid_from: string;
  valid_until: string | null;
}

interface Band {
  axes: number[];
  ccd: number[];
  cc: number[];
}

interface AnexoFile {
  source: string;
  valid_from: string;
  valid_until_prev: string;
  tables: Record<string, Record<string, Band>>;
}

export function loadAnttRes6084Anexo(cwd = process.cwd()): {
  source: string;
  validFrom: string;
  validUntilPrev: string;
  rows: AnttFloorRateInsert[];
} {
  const parsed = JSON.parse(
    readFileSync(join(cwd, 'data/antt_res_6084_2026_anexo_ii.json'), 'utf8')
  ) as AnexoFile;

  const rows: AnttFloorRateInsert[] = [];
  for (const [operation_table, cargos] of Object.entries(parsed.tables)) {
    for (const [cargo_type, band] of Object.entries(cargos)) {
      if (band.axes.length !== band.ccd.length || band.axes.length !== band.cc.length) {
        throw new Error(`Anexo II ${operation_table}/${cargo_type}: axes/ccd/cc length mismatch`);
      }
      band.axes.forEach((axes_count, i) => {
        rows.push({
          operation_table,
          cargo_type,
          axes_count,
          ccd: band.ccd[i],
          cc: band.cc[i],
          valid_from: parsed.valid_from,
          valid_until: null,
        });
      });
    }
  }

  return {
    source: parsed.source,
    validFrom: parsed.valid_from,
    validUntilPrev: parsed.valid_until_prev,
    rows,
  };
}

export function findAnttRes6084Rate(
  rows: AnttFloorRateInsert[],
  table: string,
  cargo: string,
  axes: number
): AnttFloorRateInsert {
  const hit = rows.find(
    (r) => r.operation_table === table && r.cargo_type === cargo && r.axes_count === axes
  );
  if (!hit) {
    throw new Error(`Missing ${table}/${cargo}/${axes} in Res. 6.084/2026`);
  }
  return hit;
}
