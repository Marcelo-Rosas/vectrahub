/**
 * Rotha feira — catálogo canônico = PDF Scribd 830294749 (CÓD. DO PRODUTO).
 * NF R#### = alias (nf_skus), não SKU.
 * Pack = caixa similar Konnen ou C×L×A catálogo 2025 (suportes numerados).
 */

import {
  PACK,
  packAnilhaKg,
  packAssembledM,
  packBarLengthM,
  packBarMontadaKg,
  packBumperKg,
  packDumbbellPieceKg,
  packHalterPieceKg,
  packKettleKg,
  type RothaPack,
} from './rotha-konnen-pack';

export type RothaProductKind = 'kit' | 'individual';

export type RothaCatalogGroup =
  | 'DUMBBELLS'
  | 'ANILHAS'
  | 'BARRAS MONTADAS'
  | 'BARRAS'
  | 'PUXADORES'
  | 'SUPORTES'
  | 'FUNCIONAL';

export type RothaFeiraProduct = {
  sku: string;
  name: string;
  catalog_group: RothaCatalogGroup;
  product_kind: RothaProductKind;
  weight_kg: number;
  volume_m3: number;
  length_m: number;
  width_m: number;
  height_m: number;
  source?: string;
  homolog_pending?: boolean;
  /** Alias ERP/NF. Não usar como sku. */
  nf_skus?: string[];
};

const SRC = 'catalogo-830294749+pack';
const SRC_2025 = 'catalogo-830294749+medidas-2025';

function item(
  sku: string,
  name: string,
  catalog_group: RothaCatalogGroup,
  pack: RothaPack,
  kind: RothaProductKind = 'individual',
  source = SRC,
  homolog_pending = false,
  nf_skus?: string[]
): RothaFeiraProduct {
  return {
    sku,
    name,
    catalog_group,
    product_kind: kind,
    ...pack,
    source,
    homolog_pending,
    ...(nf_skus?.length ? { nf_skus } : {}),
  };
}

function rangeKg(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let kg = from; kg <= to + 1e-9; kg += step) out.push(Math.round(kg * 10) / 10);
  return out;
}

function skuAnvan(kg: number): string {
  return kg % 1 === 0 ? `ANVAN${kg}` : `ANVAN${kg}`;
}

/** 2 níveis — catálogo 2025 pág. 35. Peso ancora Konnen 13 pares = 95 kg. */
const SUP_2N: { pares: number; c: number; nf?: string[] }[] = [
  { pares: 4, c: 1.16 },
  { pares: 5, c: 1.38 },
  { pares: 6, c: 1.6 },
  { pares: 9, c: 2.26 },
  { pares: 10, c: 2.48 },
  { pares: 12, c: 2.92 },
  { pares: 13, c: 3.14, nf: ['R3074.1'] },
];

/** 3 níveis — catálogo 2025 pág. 36. Peso estimado (sem NF). */
const SUP_3N: { pares: number; c: number }[] = [
  { pares: 9, c: 1.6 },
  { pares: 12, c: 2.04 },
  { pares: 15, c: 2.48 },
];

const DBSIX_EXTRA = [40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120];

const dumbbells: RothaFeiraProduct[] = [
  ...rangeKg(12, 36, 2).map((kg) =>
    item(`DBSIX${kg}`, `Dumbbell Six ${kg} kg`, 'DUMBBELLS', packDumbbellPieceKg(kg))
  ),
  ...DBSIX_EXTRA.map((kg) =>
    item(
      `DBSIX${kg}`,
      `Dumbbell Six ${kg} kg`,
      'DUMBBELLS',
      packDumbbellPieceKg(kg),
      'individual',
      SRC,
      true
    )
  ),
  ...rangeKg(1, 10, 1).map((kg) =>
    item(`HALSEX${kg}`, `Halter sextavado inox ${kg} kg`, 'DUMBBELLS', packHalterPieceKg(kg))
  ),
  ...rangeKg(1, 10, 1).map((kg) =>
    item(
      `HALTSEX${kg}`,
      `Halter sextavado texturizado ${kg} kg`,
      'DUMBBELLS',
      packHalterPieceKg(kg)
    )
  ),
];

const anilhas: RothaFeiraProduct[] = [1, 2.5, 5, 10, 15, 20, 30].map((kg) => {
  const nf =
    kg === 2.5
      ? ['R6002']
      : kg === 5
        ? ['R6005']
        : kg === 10
          ? ['R6010']
          : kg === 20
            ? ['R6020']
            : undefined;
  return item(
    skuAnvan(kg),
    `Anilha vulcanizada Black ${kg} kg`,
    'ANILHAS',
    packAnilhaKg(kg),
    'individual',
    SRC,
    kg === 1 || kg === 30,
    nf
  );
});

const barrasMontadas: RothaFeiraProduct[] = rangeKg(10, 65, 5).map((kg) =>
  item(
    `BMSIX${kg}`,
    `Barra montada Six ${kg} kg`,
    'BARRAS MONTADAS',
    packBarMontadaKg(kg),
    'individual',
    SRC,
    kg > 30
  )
);

function barWeight(lengthM: number, olympic: boolean): number {
  if (olympic) return Math.round(8 + lengthM * 6);
  return Math.round(6 + lengthM * 4);
}

const barLens = [1.2, 1.5, 1.8, 2, 2.2];

const barras: RothaFeiraProduct[] = [
  ...barLens.map((m) =>
    item(
      m === 2 ? 'OLBACR-2' : `OLBACR-${m.toFixed(2)}`,
      `Barra olímpica inox ${m.toFixed(2).replace('.', ',')} m`,
      'BARRAS',
      packBarLengthM(m, barWeight(m, true))
    )
  ),
  item('BAW', 'Barra W inox', 'BARRAS', PACK.barraW),
  item('BAH', 'Barra H pegada revestida', 'BARRAS', PACK.barraW),
  ...barLens.map((m) =>
    item(
      m === 2 ? 'STBACROMR-2' : `STBACROMR-${m.toFixed(2)}`,
      `Barra standard cromada ${m.toFixed(2).replace('.', ',')} m`,
      'BARRAS',
      packBarLengthM(m, barWeight(m, false))
    )
  ),
  item('STBA50', 'Barra 50 cm montagem dumbbell', 'BARRAS', packBarLengthM(0.5, 5, 50)),
  item('BAHEXAG', 'Barra hexagonal', 'BARRAS', PACK.barraOlimpica, 'individual', SRC, true),
];

const puxadores: RothaFeiraProduct[] = [
  item('PUX-W', 'Puxador W revestido', 'PUXADORES', PACK.puxador, 'individual', SRC, false, [
    'R1610',
  ]),
  item('PUX-RETO', 'Puxador reto revestido', 'PUXADORES', PACK.puxador, 'individual', SRC, false, [
    'R1604',
  ]),
  item('PUX-PULLEY', 'Puxador pulley revestido', 'PUXADORES', PACK.puxador),
  item('PUX-ROM', 'Puxador romano pintado', 'PUXADORES', PACK.puxador),
  item('PUX-V', 'Puxador V revestido', 'PUXADORES', PACK.puxador, 'individual', SRC, false, [
    'R1609',
  ]),
  item('PUX-TRI', 'Puxador triângulo', 'PUXADORES', PACK.puxador),
  item('PUX-CORDA', 'Puxador corda', 'PUXADORES', PACK.puxadorCorda, 'individual', SRC, false, [
    'R1601',
  ]),
  item('PUX-ALCA', 'Puxador glúteo com alça', 'PUXADORES', PACK.puxador, 'individual', SRC, false, [
    'R1607',
  ]),
];

const suportes: RothaFeiraProduct[] = [
  ...SUP_2N.map((row) =>
    item(
      `SUPDUMBLACK-${row.pares}`,
      `Suporte dumbbell Black ${row.pares} pares (2 níveis)`,
      'SUPORTES',
      packAssembledM(row.c, 0.75, 0.72, Math.round((row.pares / 13) * 95)),
      'individual',
      SRC_2025,
      row.pares !== 13,
      row.nf
    )
  ),
  ...SUP_3N.map((row) =>
    item(
      `SUPDUMBLACK-3N-${row.pares}`,
      `Suporte dumbbell Black ${row.pares} pares (3 níveis)`,
      'SUPORTES',
      packAssembledM(row.c, 0.75, 0.84, Math.round((row.pares / 15) * 120)),
      'individual',
      SRC_2025,
      true
    )
  ),
  item(
    'SUPDUMBLACK-SEXT',
    'Suporte dumbbell sextavado',
    'SUPORTES',
    PACK.suporteDbSext,
    'individual',
    SRC,
    true
  ),
  item(
    'SUPTORHAL-PRE-5',
    'Suporte curvado 5 pares',
    'SUPORTES',
    packAssembledM(1.35, 0.53, 0.53, 40),
    'individual',
    SRC,
    true
  ),
  item(
    'SUPTORHAL-PRE-10',
    'Suporte curvado 10 pares',
    'SUPORTES',
    PACK.suporteHalter10,
    'individual',
    SRC,
    false,
    ['R1531.1']
  ),
  item(
    'SUPBARRA-BLACK',
    'Suporte barra Black / barras montadas',
    'SUPORTES',
    PACK.suporteBarraMont,
    'individual',
    SRC,
    false,
    ['R1511.1']
  ),
  item(
    'SUPBOLA',
    'Suporte bola de pilates',
    'SUPORTES',
    PACK.funcionalPeq,
    'individual',
    SRC,
    true
  ),
  item('SUPTRX', 'Suporte TRX', 'SUPORTES', PACK.funcionalPeq, 'individual', SRC, true),
  item(
    'LAND001',
    'Suporte barra landmine',
    'SUPORTES',
    packAssembledM(0.4, 0.4, 0.2, 18),
    'individual',
    SRC,
    true
  ),
  item(
    'CANMODBARRA002-6',
    'Canhoneira Black 6 barras',
    'SUPORTES',
    packAssembledM(0.8, 0.8, 0.35, 22),
    'individual',
    SRC,
    true
  ),
  item(
    'CANMODBARRA002-12',
    'Canhoneira Black 12 barras',
    'SUPORTES',
    packAssembledM(0.9, 0.9, 0.4, 38),
    'individual',
    SRC,
    true
  ),
  item(
    'SUPKET-2',
    'Suporte kettlebells 2 travessas',
    'SUPORTES',
    packAssembledM(0.9, 0.5, 0.8, 32),
    'individual',
    SRC,
    true
  ),
  item(
    'SUPKET-3',
    'Suporte kettlebells 3 travessas',
    'SUPORTES',
    PACK.suporteKettle,
    'individual',
    SRC,
    true
  ),
  item(
    'SUPCOL',
    'Suporte colchonetes simples',
    'SUPORTES',
    PACK.colchonete,
    'individual',
    SRC,
    true
  ),
  item(
    'SUPCOL-DIV',
    'Suporte colchonetes com divisão',
    'SUPORTES',
    PACK.colchonete,
    'individual',
    SRC,
    true
  ),
];

const kettleKgs = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32];

const funcional: RothaFeiraProduct[] = [
  item('BUMPER', 'Anilha bumper plate', 'FUNCIONAL', packBumperKg(10), 'individual', SRC, true),
  item(
    'FITA01',
    'Fita de treinamento suspenso',
    'FUNCIONAL',
    PACK.funcionalPeq,
    'individual',
    SRC,
    true
  ),
  ...[5, 10, 15, 20, 25].map((kg) =>
    item(
      `SUPERBAG-${kg}`,
      `Superbag ${kg} kg`,
      'FUNCIONAL',
      packAssembledM(0.4, 0.3, 0.2, kg),
      'individual',
      SRC,
      true
    )
  ),
  item(
    'CORDA',
    'Corda naval 10 m',
    'FUNCIONAL',
    packAssembledM(0.4, 0.4, 0.4, 12),
    'individual',
    SRC,
    true
  ),
  ...[1, 5, 10, 20].map((kg) =>
    item(
      `TORNO-${kg}`,
      `Tornozeleira ${kg} kg`,
      'FUNCIONAL',
      packAssembledM(0.25, 0.15, 0.08, kg),
      'individual',
      SRC,
      true
    )
  ),
  item(
    'COLCEM',
    'Colchonete emborrachado 4 cm',
    'FUNCIONAL',
    PACK.colchonete,
    'individual',
    SRC,
    true
  ),
  item('PROTETOR', 'Protetor de barra', 'FUNCIONAL', PACK.funcionalPeq, 'individual', SRC, true),
  ...kettleKgs.map((kg) =>
    item(`KETTEX${kg}`, `Kettlebell texturizado ${kg} kg`, 'FUNCIONAL', packKettleKg(kg))
  ),
];

export const ROTHA_CANONICAL_CATALOG: RothaFeiraProduct[] = [
  ...dumbbells,
  ...anilhas,
  ...barrasMontadas,
  ...barras,
  ...puxadores,
  ...suportes,
  ...funcional,
];

/** @deprecated nome antigo — mesmo array canônico. */
export const ROTHA_SUMARIO_CATALOG = ROTHA_CANONICAL_CATALOG;

export const ROTHA_CATALOG_GROUP_ORDER: RothaCatalogGroup[] = [
  'DUMBBELLS',
  'ANILHAS',
  'BARRAS MONTADAS',
  'BARRAS',
  'PUXADORES',
  'SUPORTES',
  'FUNCIONAL',
];

export function normalizeRothaSku(sku: string): string {
  return String(sku).trim().replace(/\s+/g, '-').toUpperCase();
}

export function rothaCatalogLine(entry: Pick<RothaFeiraProduct, 'catalog_group'>): string {
  return entry.catalog_group;
}

export function rothaCatalogLineFromEntry(entry: {
  catalogGroup?: string;
  productKind?: string;
  sku: string;
}): string {
  if (entry.catalogGroup) return entry.catalogGroup.toUpperCase();
  return 'DUMBBELLS';
}

/** @deprecated Ploomes — catálogo agora é PDF comercial. */
export function rothaCatalogGroupFromPloomes(
  _ploomesGroup: string,
  _sku: string
): RothaCatalogGroup {
  return 'DUMBBELLS';
}

export const ROTHA_KIT_DB_WEIGHTS_KG = new Set<number>();

export function parseRothaDumbbellWeightKg(_sku: string): number | null {
  return null;
}

export function isRothaSkuCoveredByKit(_sku: string): boolean {
  return false;
}

/** @deprecated usar ROTHA_CANONICAL_CATALOG */
export const ROTHA_KITS: RothaFeiraProduct[] = ROTHA_CANONICAL_CATALOG.filter(
  (p) => p.product_kind === 'kit'
);

/** @deprecated usar ROTHA_CANONICAL_CATALOG */
export const ROTHA_PDF_HOMOLOG: RothaFeiraProduct[] = ROTHA_CANONICAL_CATALOG.filter(
  (p) => p.homolog_pending
);
