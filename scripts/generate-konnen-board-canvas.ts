/**
 * Gera JSON + canvas quadro por categoria a partir do audit report.
 *   npx tsx scripts/generate-konnen-board-canvas.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const auditPath = join(root, 'docs/homolog/konnen-site-audit-report.json');
const boardPath = join(root, 'docs/homolog/konnen-site-board-by-category.json');
const stackPath = join(root, 'src/lib/__tests__/fixtures/konnen-site-stack-by-sku.json');

const audit = JSON.parse(readFileSync(auditPath, 'utf-8')) as {
  scrapedAt: string;
  catalogSkuCount: number;
  lines: Array<{
    lineId: string;
    lineLabel: string;
    group: string;
    categoryUrl: string;
    pagesFetched: number;
    productsOnSite: number;
    matchedCatalog: number;
    missingFromCatalog: number;
    siteOnlySkus: string[];
  }>;
  products: Array<{
    lineId: string;
    group: string;
    slug: string;
    name: string;
    sku: string;
    inCatalog: boolean;
    weightKg: number | null;
    stackWeightKg: number | null;
    stackLbs: string | null;
    dimensionsMm: [number, number, number] | null;
    url: string;
    parseErrors?: string[];
  }>;
};

let stackBySku: Record<string, { stackLbs: string }> = {};
try {
  stackBySku = JSON.parse(readFileSync(stackPath, 'utf-8'));
} catch {
  /* optional */
}

const GROUP_LABELS: Record<string, string> = {
  baterias: 'Baterias de Peso',
  articulados: 'Articulados',
  bancos: 'Bancos e Racks',
  cardio: 'Cardio',
};

const groups = ['baterias', 'articulados', 'bancos', 'cardio'];

const board = {
  scrapedAt: audit.scrapedAt,
  catalogSkuCount: audit.catalogSkuCount,
  categories: {} as Record<string, unknown>,
};

for (const group of groups) {
  const lines = audit.lines.filter((l) => l.group === group);
  const products = audit.products.filter((p) => p.group === group);
  const inCatalog = products.filter((p) => p.inCatalog);

  board.categories[group] = {
    label: GROUP_LABELS[group],
    summary: {
      lines: lines.length,
      pagesFetched: lines.reduce((s, l) => s + l.pagesFetched, 0),
      productsScraped: products.length,
      uniqueSkus: new Set(products.filter((p) => p.sku).map((p) => p.sku)).size,
      inCatalog: inCatalog.length,
      gaps: products.length - inCatalog.length,
      coveragePct: products.length ? Math.round((inCatalog.length / products.length) * 100) : 0,
      withWeightKg: products.filter((p) => p.weightKg != null).length,
      withStackKg: products.filter((p) => p.stackWeightKg != null).length,
      withDimensions: products.filter((p) => p.dimensionsMm).length,
      withStackLbsMapped: products.filter((p) => p.stackLbs).length,
    },
    lines: lines.map((l) => ({
      id: l.lineId,
      label: l.lineLabel,
      url: l.categoryUrl,
      pages: l.pagesFetched,
      site: l.productsOnSite,
      inCatalog: l.matchedCatalog,
      gaps: l.missingFromCatalog,
      coveragePct: l.productsOnSite ? Math.round((l.matchedCatalog / l.productsOnSite) * 100) : 0,
      gapSkus: l.siteOnlySkus,
    })),
    products: products.map((p) => ({
      lineId: p.lineId,
      sku: p.sku || null,
      slug: p.slug,
      name: p.name,
      inCatalog: p.inCatalog,
      weightKg: p.weightKg,
      stackWeightKg: p.stackWeightKg,
      stackLbs: p.stackLbs ?? (p.sku && stackBySku[p.sku]?.stackLbs) ?? null,
      dimensionsMm: p.dimensionsMm,
      url: p.url,
      parseErrors: p.parseErrors?.length ? p.parseErrors : undefined,
    })),
  };
}

writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, 'utf-8');
console.log('wrote', boardPath);

const cats = ['baterias', 'articulados', 'bancos', 'cardio'] as const;
type BoardCategory = {
  label: string;
  summary: Record<string, number>;
  lines: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
};
const boardCategories = board.categories as Record<(typeof cats)[number], BoardCategory>;

const summaries = cats.map((id) => ({
  id,
  label: boardCategories[id].label,
  ...boardCategories[id].summary,
}));

const lines = cats.flatMap((id) =>
  boardCategories[id].lines.map(({ gapSkus: _g, url: _u, ...rest }) => ({
    ...rest,
    group: id,
    groupLabel: boardCategories[id].label,
  }))
);

function compact(p: Record<string, unknown>) {
  const dims = p.dimensionsMm as number[] | null;
  return {
    g: p.lineId,
    s: (p.sku as string) || '',
    n: p.name,
    c: p.inCatalog ? 1 : 0,
    w: p.weightKg as number | null,
    st: p.stackWeightKg as number | null,
    lb: p.stackLbs as string | null,
    d: dims ? dims.join('x') : '',
  };
}

const products: Record<string, ReturnType<typeof compact>[]> = {};
for (const id of cats) {
  products[id] = boardCategories[id].products.map((p) => compact(p));
}

const canvasPath = join(
  process.env.USERPROFILE ?? '',
  '.cursor/projects/c-Users-marce-vectra-hub/canvases/konnen-site-board-by-category.canvas.tsx'
);

const canvas = `import {
  BarChart,
  Callout,
  CollapsibleSection,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type CatId = "baterias" | "articulados" | "bancos" | "cardio";

const SCRAPED_AT = ${JSON.stringify(board.scrapedAt)};
const CATALOG_SKUS = ${board.catalogSkuCount};

const SUMMARIES = ${JSON.stringify(summaries, null, 2)} as Array<{
  id: CatId;
  label: string;
  productsScraped: number;
  inCatalog: number;
  gaps: number;
  coveragePct: number;
  uniqueSkus: number;
  withWeightKg: number;
  withStackKg: number;
  withDimensions: number;
  withStackLbsMapped: number;
  lines: number;
  pagesFetched: number;
}>;

const LINES = ${JSON.stringify(lines, null, 2)} as Array<{
  group: CatId;
  groupLabel: string;
  id: string;
  label: string;
  pages: number;
  site: number;
  inCatalog: number;
  gaps: number;
  coveragePct: number;
}>;

const PRODUCTS = ${JSON.stringify(products, null, 2)} as Record<
  CatId,
  Array<{
    g: string;
    s: string;
    n: string;
    c: number;
    w: number | null;
    st: number | null;
    lb: string | null;
    d: string;
  }>
>;

const CAT_LABELS: Record<CatId, string> = {
  baterias: "Baterias de Peso",
  articulados: "Articulados",
  bancos: "Bancos e Racks",
  cardio: "Cardio",
};

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n == null || Number.isNaN(n)) return "—";
  return \`\${n.toLocaleString("pt-BR")}\${suffix}\`;
}

function rowTone(inCatalog: boolean): "success" | "danger" {
  return inCatalog ? "success" : "danger";
}

export default function KonnenSiteBoardCanvas() {
  const theme = useHostTheme();
  const [activeCat, setActiveCat] = useCanvasState<CatId>("activeCat", "baterias");
  const [showGapsOnly, setShowGapsOnly] = useCanvasState<boolean>("gapsOnly", false);

  const summary = SUMMARIES.find((s) => s.id === activeCat)!;
  const products = (PRODUCTS[activeCat] ?? []).filter((p) => (showGapsOnly ? !p.c : true));
  const lineRows = LINES.filter((l) => l.group === activeCat).map((l) => [
    l.label,
    String(l.pages),
    String(l.site),
    String(l.inCatalog),
    String(l.gaps),
    \`\${l.coveragePct}%\`,
  ]);

  const productRows = products.map((p) => [
    p.s || p.g,
    p.n,
    p.g,
    p.c ? "Sim" : "Não",
    fmt(p.w, " kg"),
    p.st != null ? fmt(p.st, " kg") : "—",
    p.lb ?? "—",
    p.d || "—",
  ]);

  const chartData = SUMMARIES.map((s) => ({
    label: s.label.split(" ")[0] ?? s.id,
    inCatalog: s.inCatalog,
    gaps: s.gaps,
  }));

  return (
    <Stack style={{ padding: 24, gap: 20, color: theme.text.primary }}>
      <Stack style={{ gap: 6 }}>
        <H1>Konnen — quadro por categoria</H1>
        <Text style={{ color: theme.text.secondary, fontSize: 13 }}>
          Source: konnen-site-audit-report.json · scraped{" "}
          {new Date(SCRAPED_AT).toLocaleString("pt-BR")} · catálogo {CATALOG_SKUS} SKUs
        </Text>
      </Stack>

      <Grid columns={4} style={{ gap: 12 }}>
        {SUMMARIES.map((s) => (
          <Stat
            key={s.id}
            label={s.label}
            value={String(s.productsScraped)}
            detail={\`\${s.coveragePct}% no catálogo · \${s.gaps} gaps\`}
            tone={s.coveragePct >= 80 ? "success" : s.coveragePct >= 40 ? "warning" : "danger"}
            onClick={() => setActiveCat(s.id)}
            style={{
              cursor: "pointer",
              outline: activeCat === s.id ? \`2px solid \${theme.accent.primary}\` : undefined,
            }}
          />
        ))}
      </Grid>

      <BarChart
        title="Produtos scrapeados: no catálogo vs gaps (por categoria)"
        data={chartData}
        series={[
          { key: "inCatalog", label: "No catálogo", tone: "success" },
          { key: "gaps", label: "Gaps", tone: "danger" },
        ]}
        xKey="label"
        caption="Contagem de produtos por grupo Equipamentos"
      />

      <Row style={{ gap: 8, flexWrap: "wrap" }}>
        {(Object.keys(CAT_LABELS) as CatId[]).map((id) => (
          <Pill
            key={id}
            tone={activeCat === id ? "info" : "neutral"}
            onClick={() => setActiveCat(id)}
            style={{ cursor: "pointer" }}
          >
            {CAT_LABELS[id]}
          </Pill>
        ))}
        <Pill
          tone={showGapsOnly ? "warning" : "neutral"}
          onClick={() => setShowGapsOnly(!showGapsOnly)}
          style={{ cursor: "pointer" }}
        >
          {showGapsOnly ? "Só gaps" : "Todos produtos"}
        </Pill>
      </Row>

      <Callout tone="info">
        {CAT_LABELS[activeCat]} — {summary.productsScraped} produtos · {summary.lines} linhas ·{" "}
        {summary.pagesFetched} páginas · {summary.uniqueSkus} SKUs únicos · peso {summary.withWeightKg} · stack{" "}
        {summary.withStackKg} · dim {summary.withDimensions}
      </Callout>

      <CollapsibleSection title="Linhas da categoria" defaultOpen>
        <Table
          headers={["Linha", "Págs", "Site", "Catálogo", "Gaps", "Cobertura"]}
          rows={lineRows}
          columnAlign={["left", "right", "right", "right", "right", "right"]}
          striped
        />
      </CollapsibleSection>

      <Stack style={{ gap: 8 }}>
        <H2>
          Produtos — {CAT_LABELS[activeCat]} ({products.length})
        </H2>
        <Table
          headers={["SKU/Slug", "Nome", "Linha", "Catálogo", "Peso", "Stack kg", "Stack lb", "Dim mm"]}
          rows={productRows}
          rowTone={products.map((p) => rowTone(!!p.c))}
          columnAlign={["left", "left", "left", "center", "right", "right", "right", "left"]}
          striped
          stickyHeader
        />
      </Stack>

      <Text style={{ color: theme.text.tertiary, fontSize: 12 }}>
        JSON: docs/homolog/konnen-site-board-by-category.json
      </Text>
    </Stack>
  );
}
`;

writeFileSync(canvasPath, canvas, 'utf-8');
console.log('wrote', canvasPath);
console.log('bytes', canvas.length);
