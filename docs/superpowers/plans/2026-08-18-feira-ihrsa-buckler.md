# Feira IHRSA-Buckler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schema `feira` tenant-scoped, cotação `/feira` (vendedor Buckler) com origem SBC + pedágio 12% sobre frete peso, COT PDF carimbo IHRSA-BUCKLER, dashboard Vectra `/feira/dashboard` alimentado por Edge (não amostra).

**Architecture:** Mesmo projeto Supabase Hub, schema `feira` + RLS por domínio de e-mail. Motor `calculate-freight` inalterado (`toll_value` omitido). Pedágio = pós-cálculo puro em `src/lib/fair-toll.ts` (espelho `_shared`). Quotes **não** entram em `public.quotes`. Dashboard já existe em UI; este plano liga persistência + feed real.

**Tech Stack:** Vite + React 18 + TS, Supabase Postgres/RLS/Auth/Edge (Deno), TanStack Query, Vitest, jsPDF (`generateQuotePdf`), npm.

**Spec:** `docs/superpowers/specs/2026-08-18-feira-ihrsa-buckler-design.md`

## Global Constraints

- Moeda UI: sempre `formatCurrency` (2 casas). Pedágio e totais em **reais** (`numeric`), não centavos, alinhado a `quotes.value`.
- Tipos: regenerar `src/integrations/supabase/types.generated.ts` após migration (schema `feira` pode precisar `search_path` / generate com schemas).
- Edge: `invokeEdgeFunction`; lógica pura duplicada em `supabase/functions/_shared/` — não importar `src/` no Deno.
- Pedágio: `pedagio = round2(frete_peso * (toll_pct / 100))` com `toll_pct = faixa.toll_percent ?? company.toll_fallback_percent`. **Proibido** `max(toll_percent, 12)`.
- Origem: sempre `feira.companies.origin_label` (Buckler = `São Bernardo do Campo - SP`). UI locked.
- Cliente: só `feira.clients`. Nunca `insert` em `public.clients`.
- npm only. Commits só se humano pedir.
- Dashboard UI (`FairDashboard.tsx`, dropdown destino) já aprovado — não redesenhar; só trocar feed amostra → Edge.

---

## File map

| File | Role |
|---|---|
| `src/lib/fair-toll.ts` | `computeFairToll({ freightWeight, tableTollPercent, fallbackPercent })` |
| `src/lib/__tests__/fair-toll.test.ts` | TDD fórmula + round2 + null table |
| `supabase/functions/_shared/fair-toll.ts` | Espelho Deno |
| `supabase/migrations/20260818140000_feira_schema.sql` | Schema, tables, RLS, seed Buckler, helpers domínio |
| `supabase/functions/feira-save-quote/index.ts` | CNPJ persist + quote + lines + toll |
| `supabase/functions/feira-quotes-feed/index.ts` | KPIs + rotas + quotes para dashboard |
| `src/pages/Auth.tsx` + `FairQuote.tsx` | Signup domínio; origem locked; CNPJ; save; PDF |
| `src/lib/generateQuotePdf.ts` | `event_flag` + linha pedágio estimado + disclaimer |
| `src/hooks/useFairDashboardFeed.ts` | Chama `feira-quotes-feed` |
| `scripts/smoke-fair-toll-capitals.ts` | Origem SBC + KM SBC→capitais |
| `scripts/import-shipper-product-catalog.ts` | Import para `feira.products` (não `public.shipper_products`) |

**Já existe (não recriar):** `/feira`, kit picker, `/feira/dashboard` UI, `shipper-product-catalog.ts`, fixture Buckler JSON, smoke Itajaí (atualizar origem).

**Não fazer (spec §11):** conversão TMS, WebRouter, role `feira` nova, Tremor, tabela `fracionado_parceiro`.

---

### Task 1: Fórmula pedágio pura (TDD)

**Files:**
- Create: `src/lib/fair-toll.ts`
- Create: `src/lib/__tests__/fair-toll.test.ts`
- Create: `supabase/functions/_shared/fair-toll.ts`

**Interfaces:**
- Produces: `computeFairToll(input: FairTollInput): FairTollResult`
- `FairTollInput = { freightWeight: number; tableTollPercent: number \| null; fallbackPercent: number }`
- `FairTollResult = { tollPercent: number; pedagio: number; method: 'table_percent' \| 'fallback_12' }` — `method` usa `'fallback_12'` só quando caiu no fallback (mesmo se fallback ≠ 12, nome do spec; se `fallbackPercent !== 12` usar `method: 'fallback'`). **Corrigir:** `method: 'table_percent' | 'fallback'`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { computeFairToll } from '@/lib/fair-toll';

describe('computeFairToll', () => {
  it('usa fallback 12% quando tableTollPercent null', () => {
    const r = computeFairToll({ freightWeight: 996.8, tableTollPercent: null, fallbackPercent: 12 });
    expect(r.method).toBe('fallback');
    expect(r.tollPercent).toBe(12);
    expect(r.pedagio).toBeCloseTo(119.62, 2);
  });

  it('usa tableTollPercent 8% e NÃO aplica max com 12', () => {
    const r = computeFairToll({ freightWeight: 1000, tableTollPercent: 8, fallbackPercent: 12 });
    expect(r.method).toBe('table_percent');
    expect(r.pedagio).toBeCloseTo(80, 2);
  });

  it('tableTollPercent 0 é valor válido (não cai no fallback)', () => {
    const r = computeFairToll({ freightWeight: 1000, tableTollPercent: 0, fallbackPercent: 12 });
    expect(r.method).toBe('table_percent');
    expect(r.pedagio).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/__tests__/fair-toll.test.ts
```

Expected: FAIL module not found.

- [ ] **Step 3: Implement**

```ts
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
```

Copiar o mesmo arquivo para `supabase/functions/_shared/fair-toll.ts` (sem path `@/`).

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/fair-toll.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit** (só se humano pedir)

---

### Task 2: Migration schema `feira`

**Files:**
- Create: `supabase/migrations/20260818140000_feira_schema.sql`

**Interfaces:**
- Produces: `feira.companies`, `feira.user_company`, `feira.clients`, `feira.products`, `feira.product_boxes`, `feira.quotes`, `feira.quote_lines`
- Helpers SQL: `feira.email_domain(text)`, `feira.current_company_id()`, `feira.is_vectra_staff()`

- [ ] **Step 1: Write migration** (aplicar via SQL Editor se `db push` drift)

Conteúdo mínimo:

```sql
CREATE SCHEMA IF NOT EXISTS feira;

CREATE TABLE feira.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  origin_uf CHAR(2) NOT NULL,
  origin_label TEXT NOT NULL,
  email_domains TEXT[] NOT NULL,
  event_flag TEXT NOT NULL,
  toll_fallback_percent NUMERIC(6,2) NOT NULL DEFAULT 12,
  price_table_id UUID REFERENCES public.price_tables(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feira.user_company (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES feira.companies(id)
);

CREATE TABLE feira.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES feira.companies(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  address_number TEXT,
  neighborhood TEXT,
  zip_code TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, cnpj)
);

CREATE TABLE feira.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES feira.companies(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  boxes_total INTEGER NOT NULL DEFAULT 1,
  box_types_count INTEGER NOT NULL DEFAULT 1,
  weight_kg_per_unit NUMERIC(12,3) NOT NULL,
  volume_m3_per_unit NUMERIC(12,6) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (company_id, sku)
);

CREATE TABLE feira.product_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES feira.products(id) ON DELETE CASCADE,
  box_type TEXT NOT NULL,
  length_mm INTEGER NOT NULL,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  boxes_per_unit NUMERIC(8,2) NOT NULL DEFAULT 1,
  group_weight_kg NUMERIC(12,3) NOT NULL DEFAULT 0,
  volume_m3 NUMERIC(12,6) NOT NULL DEFAULT 0,
  UNIQUE (product_id, box_type)
);

CREATE TABLE feira.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES feira.companies(id),
  client_id UUID REFERENCES feira.clients(id),
  quote_code TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  km_distance NUMERIC(10,1) NOT NULL,
  cargo_value NUMERIC(14,2) NOT NULL,
  weight_kg NUMERIC(12,3) NOT NULL,
  volume_m3 NUMERIC(12,6) NOT NULL,
  freight_weight NUMERIC(14,2) NOT NULL,
  pedagio_estimado NUMERIC(14,2) NOT NULL,
  toll_percent NUMERIC(6,2) NOT NULL,
  toll_method TEXT NOT NULL CHECK (toll_method IN ('table_percent', 'fallback')),
  hub_total_cliente NUMERIC(14,2) NOT NULL,
  total_exibido NUMERIC(14,2) NOT NULL,
  event_flag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  pricing_breakdown JSONB,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feira.quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES feira.quotes(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  selected_box_types TEXT[],
  weight_kg NUMERIC(12,3) NOT NULL,
  volume_m3 NUMERIC(12,6) NOT NULL,
  boxes_count NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_feira_quotes_company ON feira.quotes(company_id, created_at DESC);
CREATE INDEX idx_feira_quotes_dest ON feira.quotes(company_id, destination);

CREATE OR REPLACE FUNCTION feira.email_domain(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(split_part(trim(p_email), '@', 2));
$$;

CREATE OR REPLACE FUNCTION feira.is_vectra_staff()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@vectracargo.com.br';
$$;

CREATE OR REPLACE FUNCTION feira.current_company_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT uc.company_id FROM feira.user_company uc WHERE uc.user_id = auth.uid();
$$;

-- RLS: enable on all tables
-- companies: SELECT se is_vectra_staff() OR email_domain(jwt.email) = ANY(email_domains)
-- clients/quotes/products: company_id = current_company_id() OR is_vectra_staff()
-- quotes INSERT: created_by = auth.uid() AND company_id = current_company_id()
-- Vectra staff: SELECT only on quotes/clients (no INSERT from dashboard)

INSERT INTO feira.companies (slug, name, origin_city, origin_uf, origin_label, email_domains, event_flag, toll_fallback_percent)
VALUES (
  'buckler',
  'Buckler Fit',
  'São Bernardo do Campo',
  'SP',
  'São Bernardo do Campo - SP',
  ARRAY['bucklerfit.com'],
  'IHRSA-BUCKLER',
  12
);
```

Trigger `on_auth_user_created`: se domínio casa com `companies.email_domains`, insert `feira.user_company`. Se `@vectracargo.com.br`, **não** cria user_company (staff). Se domínio desconhecido, **não** cria user_company (signup Auth pode existir; `/feira` Edge recusa).

- [ ] **Step 2: Apply**

Prefer SQL Editor no projeto `lrbtbrpoklgwaaclbufz` (MCP `apply_migration` já falhou por privilege; `db push` tem drift).

- [ ] **Step 3: Grant usage**

```sql
GRANT USAGE ON SCHEMA feira TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA feira TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA feira TO service_role;
```

- [ ] **Step 4: Types**

```bash
npx supabase gen types typescript --project-id lrbtbrpoklgwaaclbufz --schema public,feira > src/integrations/supabase/types.generated.ts
```

Se CLI não emitir `feira`, documentar queries untyped no hook (padrão atual `useShipperProductCatalog`).

---

### Task 3: Import catálogo Buckler → `feira.products`

**Files:**
- Modify: `scripts/import-shipper-product-catalog.ts`

**Interfaces:**
- Consumes: `buildShipperProductCatalog` from `src/lib/shipper-product-catalog.ts`
- Produces: rows in `feira.products` + `feira.product_boxes` for `slug=buckler`

- [ ] **Step 1: Point script at schema feira**

Service role: `sr.schema('feira')` se client permitir, ou `.from('products')` com `db.schema` header. Alternativa: `sr.from('feira.products')` **não funciona** no JS client — usar:

```ts
const feira = createClient(env.url, env.serviceRoleKey, {
  auth: { persistSession: false },
  db: { schema: 'feira' },
});
```

Lookup `companies` where `slug = 'buckler'`. Loop catalog entries → upsert `products` on `company_id,sku`. Replace boxes.

- [ ] **Step 2: Run**

```bash
npx tsx scripts/import-shipper-product-catalog.ts --shipper=BUCKLER
```

Expected: 19 SKUs. M2-1009 4 boxes.

- [ ] **Step 3: Hook catalog**

Modify `src/hooks/useShipperProductCatalog.ts` to read `feira.products` by `company_id` (do `useFairCompany()`), fallback fixture se vazio.

---

### Task 4: Edge `feira-save-quote`

**Files:**
- Create: `supabase/functions/feira-save-quote/index.ts`
- Modify: `supabase/config.toml` — `verify_jwt = true` (JWT usuário)

**Interfaces:**
- Body: `{ cnpj, client?, destination, km_distance, cargo_value, lines: { sku, quantity, selectedBoxTypes? }[] }`
- Origin **nunca** no body — lê `companies.origin_label`
- Calls `calculate-freight` internamente **ou** recebe breakdown do client já calculado. **Prefer client:** UI já tem `useCalculateFreight`; Edge só persiste + recalcula pedágio server-side para não confiar no cliente.

Server path:
1. Resolve `company_id` via `feira.user_company` (não staff).
2. Lookup/upsert `feira.clients` from CNPJ + `lookupCnpj` (copiar helper `_shared` ou payload client já lookup).
3. Aggregate lines from `feira.products`.
4. Invoke `calculate-freight` with `origin: company.origin_label`, `toll_value` omitted, `price_table_id: company.price_table_id`.
5. `frete_peso = components.base_cost`. `tableTollPercent = null` no MVP. `computeFairToll`.
6. `total_exibido = hub_total_cliente + pedagio` **somente se** `components.toll === 0`.
7. Insert quote + lines. `quote_code = FEIRA-YYYY-MM-NNNN` sequence per company.
8. Return `{ id, quote_code, pedagio, total_exibido, event_flag }`.

- [ ] **Step 1: Implement + local typecheck Deno**
- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy feira-save-quote --project-ref lrbtbrpoklgwaaclbufz
```

- [ ] **Step 3: Smoke save** — login `anderson.moraes@bucklerfit.com` (após signup), POST uma linha M2-1009 Fortaleza. Verificar **zero** rows novas em `public.clients`.

---

### Task 5: Edge `feira-quotes-feed`

**Files:**
- Create: `supabase/functions/feira-quotes-feed/index.ts`
- Modify: `src/hooks/useFairDashboardFeed.ts`
- Modify: `src/lib/fair-dashboard-types.ts` — já compatível (`code`, `km`, `weightKg`, `tollEstimated`)

**Interfaces:**
- Staff only (`is_vectra_staff`). Body `{ company_id?: uuid | null }` (`null`/`all` = consolidado).
- Return shape = `FairDashboardFeed` (`isSample: false`).
- KPIs: `SUM(total_exibido)`, `AVG`, `SUM(weight_kg)`, counts.
- Top destinos: `GROUP BY destination`.
- Quotes: last 50, map to `FairDashboardQuoteCard`.
- Tenants: `SELECT` companies for dropdown.

- [ ] **Step 1: Implement feed**
- [ ] **Step 2: Wire hook**

```ts
const data = await invokeEdgeFunction<FairDashboardFeed>('feira-quotes-feed', {
  body: { company_id: tenantId === 'all' ? null : tenantId },
});
```

Se Edge 404, manter fallback amostra (já existe).

- [ ] **Step 3: Deploy + open `/feira/dashboard`** — banner amostra some quando houver quotes.

---

### Task 6: Auth domínio + rotas

**Files:**
- Modify: `src/pages/Auth.tsx` — aba cadastro se `?feira=1` ou path `/feira`
- Modify: `src/hooks/useAuth.tsx` — `signUp` já existe
- Create: `src/hooks/useFairCompany.ts` — lê `feira.user_company` + `companies`
- Modify: `src/pages/FairQuote.tsx` — se sem `company_id` e e-mail não Vectra, tela “domínio não habilitado”
- Modify: `src/App.tsx` — `/feira` **não** exige role Hub (vendedor Buckler não tem `comercial`). `/feira/dashboard` staff: e-mail `@vectracargo.com.br` **ou** roles `admin|comercial`

**Signup copy:** e-mail `@bucklerfit.com`, senha, nome. Trigger associa company.

- [ ] **Step 1: Permitir `/feira` sem `requiredRoles`** (já está assim). Dashboard: além de roles, aceitar `user.email.endsWith('@vectracargo.com.br')` — senão vendedor Buckler com role vazia não deve entrar no painel (ProtectedRoute atual `admin|comercial` OK para Vectra).
- [ ] **Step 2: UI signup na Auth** quando `location.state.from.pathname === '/feira'`
- [ ] **Step 3: Manual** — criar user Buckler, abrir `/feira`, origem mostra SBC locked.

---

### Task 7: UI cotação — origem, CNPJ, pedágio, save, PDF

**Files:**
- Modify: `src/components/fair/FairQuoteCalculator.tsx`
- Modify: `src/lib/generateQuotePdf.ts`
- Create: `src/hooks/useFairSaveQuote.ts`

**Interfaces:**
- Origem: `Input` `readOnly` value=`company.origin_label`
- CNPJ: input + `lookupCnpj` → preview razão/cidade; save manda CNPJ + snapshot
- Após `calculateFreight`: `computeFairToll` com `fallbackPercent` da company; mostrar linha Pedágio estimado; total = `total_cliente + pedagio` se toll Hub 0
- Botão **Salvar COT** → `feira-save-quote`
- Botão **Emitir COT** → `generateQuotePdf({ ..., event_flag, pedagio_estimado, notes disclaimer })`

PDF changes in `drawPricingBlock` / header:

```ts
// QuotePdfPayload
event_flag?: string | null;
pedagio_estimado?: number | null;
fair_disclaimer?: boolean;
```

Header: se `event_flag`, badge text `IHRSA-BUCKLER` no topo.  
Rows: always push `['Pedágio estimado', formatCurrency(pedagio_estimado)]` when `fair_disclaimer`.  
Notes: `Pedágio estimado, sujeito a ajuste na consolidação da carga.`

- [ ] **Step 1: TDD payload flag** — se existir teste PDF, estender; senão smoke visual 1 PDF em `docs/homolog/`
- [ ] **Step 2: Wire calculator**
- [ ] **Step 3: Browser** `/feira` SBC→Fortaleza M2-1009 — pedágio ~12% do frete peso; PDF carimbo.

---

### Task 8: Smoke capitais origem SBC

**Files:**
- Modify: `scripts/smoke-fair-toll-capitals.ts`

- [ ] **Step 1: Change `ORIGIN` to `São Bernardo do Campo - SP`**
- [ ] **Step 2: Replace KM matrix** with SBC→capital estimates (Fortaleza ~3100, não 3558 Itajaí). Keep `FALLBACK_TOLL_PERCENT = 12`. After compute Hub, apply `computeFairToll` (não só CSV Hub).
- [ ] **Step 3: Run**

```bash
npx tsx scripts/smoke-fair-toll-capitals.ts
```

Expected: 27/27 OK. CSV overwrite `docs/homolog/_smoke-fair-toll-capitals.csv`.

---

### Task 9: Spec status + checklist go-live

**Files:**
- Modify: `docs/superpowers/specs/2026-08-18-feira-ihrsa-buckler-design.md` — Status: **aprovado**

Go-live:
- [ ] Signup `anderson.moraes@bucklerfit.com` entra `/feira`
- [ ] Origem SBC locked
- [ ] CNPJ lookup não cria `public.clients`
- [ ] PDF IHRSA-BUCKLER + pedágio 12%
- [ ] `/feira/dashboard` lista COT real, filtro destino
- [ ] Kanban TMS sem a linha

---

## Spec coverage

| Spec § | Task |
|---|---|
| 4 schema/RLS | 2 |
| 5 pedágio | 1, 7, 8 |
| 6 auth rotas | 6 |
| 7 PDF | 7 |
| 8 dashboard | 5 (UI já feita) |
| 9 edges | 4, 5 |
| 10 UI feira | 3, 7 |
| 13 sucesso | 9 |

## Placeholder scan

Sem TBD. `method: 'fallback'` (não `'fallback_12'` no código) alinhado ao CHECK SQL.

## Type consistency

`FairDashboardFeed` / `FairDashboardQuoteCard` já batem com dropdown destino. Edge deve devolver `code`, `km`, `weightKg`, `freightWeight`, `tollEstimated`.
