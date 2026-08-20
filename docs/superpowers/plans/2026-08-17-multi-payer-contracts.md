# Multi-Payer Contracts (CIF/FOB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir 1 CTR por pagador (FOB = destinatários; CIF = remetentes), com valor por perna persistido, soma = `quotes.value`, geração em lote no Ganha e re-emissão por `sequence`.

**Architecture:** `quotes.contract_splits` (jsonb) gravado no save; `quote_contracts` estendido com `sequence`, `party_type`, `amount_cents`, `split_snapshot`. Edge `generate-contract-pdf` faz lock via RPC `lock_quote_for_contract`, loop com timer 40s, resposta 200 parcial. Rateio puro em `contract-split.ts` (client + `_shared`), reutilizando `splitFreightProportional`.

**Tech Stack:** Vite + React 18 + TS, Supabase Postgres/RLS/Edge (Deno), TanStack Query, Vitest (`npx vitest run`), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-17-multi-payer-contracts-design.md`

## Global Constraints

- Moeda DB: centavos inteiros em `amount_cents`; `quotes.value` permanece reais (`numeric`); conversão `round(value * 100)`.
- Tipos: regenerar `@/integrations/supabase/types.generated` após migration.
- Edge: invocar via `invokeEdgeFunction`; duplicar lógica pura em `supabase/functions/_shared/` (não importar de `src/`).
- Resposta parcial: HTTP **200** + `{ partial, failed_sequences, contracts }` — nunca 500 se alguma perna subiu.
- Residual: `sort(sequence ASC)` → ajustar só `splits.at(-1)`.
- Código CTR: `CTR-2026-08-0003-01`; arquivo `CTR-2026-08-0003-01-ICARO_ONOFRE.pdf` (sem `-vN`).
- npm only; commits só quando humano pedir.

---

## File map

| File | Role |
|---|---|
| `supabase/migrations/20260817180000_multi_payer_contracts.sql` | ENUM, colunas, constraints, índices, RPC lock, backfill |
| `supabase/migrations/20260817180100_financial_has_contract_multi_payer.sql` | View `financial_receivable_kanban.has_contract` = todas sequences |
| `src/lib/contract-split.ts` | Pagadores, rateio, `calculateContractSplit`, erros |
| `src/lib/__tests__/contract-split.test.ts` | Unit tests (âncora 3700/4800, residual, basis zero) |
| `supabase/functions/_shared/contract-split.ts` | Espelho Deno da lógica pura |
| `supabase/functions/_shared/__tests__/contract-split.test.ts` | Testes Deno/vitest no edge shared |
| `src/lib/canonical-doc-ref.ts` | `ctrCodeFromQuoteCode(code, sequence?)` → `-01` |
| `supabase/functions/generate-contract-pdf/contract-clause-helpers.ts` | Mesmo sufixo + `resolveContractContratante(partyOverride)` |
| `supabase/functions/generate-contract-pdf/contract-renderer.ts` | Cláusula 5.1 por perna + ref cotação |
| `supabase/functions/generate-contract-pdf/index.ts` | Loop multi, timer, 200 parcial, RPC lock |
| `supabase/functions/workflow-orchestrator/index.ts` | Log `partial` sem falhar evento |
| `src/hooks/useQuoteContract.ts` | `useQuoteContracts` array + mutate `{ force, sequence?, quote_updated_at }` |
| `src/components/modals/quote-detail/QuoteContractPanel.tsx` | Lista N CTRs |
| `src/components/forms/QuoteForm.tsx` | Persist `contract_splits`, validação local |
| `src/components/forms/quote-form/steps/IdentificationStep.tsx` | `weight_kg`, `cargo_value` por pagador |
| `src/components/forms/quote-form/steps/ReviewStep.tsx` | Tabela split |

---

### Task 1: Migration + RPC lock + backfill

**Files:**
- Create: `supabase/migrations/20260817180000_multi_payer_contracts.sql`
- Spec ref: Apêndice A

**Interfaces:**
- Produces: ENUM `quote_contract_party_type`; colunas `quote_contracts.*`; `quotes.contract_splits`; RPC `lock_quote_for_contract(p_quote_id uuid)`.

- [ ] **Step 1: Write migration**

Copiar Apêndice A da spec. Usar `ADD CONSTRAINT` em blocos `DO $$ … EXCEPTION WHEN duplicate_object`. Backfill com `quotes.freight_type` → `party_type` / `party_id` (nunca `contractor_id`).

- [ ] **Step 2: Apply locally (se stack local) ou push remoto**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --project-id lrbtbrpoklgwaaclbufz > src/integrations/supabase/types.generated.ts
```

(Usar project ref do ambiente se diferente.)

- [ ] **Step 4: Commit** (somente se humano pedir)

```bash
git add supabase/migrations/20260817180000_multi_payer_contracts.sql src/integrations/supabase/types.generated.ts
git commit -m "feat(db): multi-payer contract splits and quote_contracts sequence"
```

---

### Task 2: Pure split logic + tests (client)

**Files:**
- Create: `src/lib/contract-split.ts`
- Create: `src/lib/__tests__/contract-split.test.ts`
- Reuse: `src/lib/cte-nfe-split.ts` → `splitFreightProportional`

**Interfaces:**
- Consumes: `splitFreightProportional(totalReais, weights)` from `cte-nfe-split.ts`
- Produces:
  - `export type ContractSplitItem = { sequence, party_type, party_id, name, amount_cents, basis, weight_kg?, cargo_value_cents?, km?, calculated_at }`
  - `export class SplitBasisZeroError extends Error`
  - `export function resolveContractPayers(quote): SplitItemInput[]` — FOB clients only, CIF shippers only
  - `export function calculateContractSplit(totalValueCents: number, items: SplitItemInput[], opts: { isOverride?: boolean }): ContractSplitItem[]`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/__tests__/contract-split.test.ts
import { describe, expect, it } from 'vitest';
import { calculateContractSplit, SplitBasisZeroError } from '@/lib/contract-split';

describe('calculateContractSplit', () => {
  it('COT-2026-08-0003 override: Icaro 370000 + Iron 480000 = 850000', () => {
    const result = calculateContractSplit(850000, [
      { sequence: 1, party_type: 'client', party_id: 'a', name: 'ICARO', basis_value: 0, override_amount_cents: 370000 },
      { sequence: 2, party_type: 'client', party_id: 'b', name: 'IRON', basis_value: 0, override_amount_cents: 480000 },
    ], { isOverride: true });
    expect(result[0].amount_cents).toBe(370000);
    expect(result[1].amount_cents).toBe(480000);
    expect(result.reduce((s, i) => s + i.amount_cents, 0)).toBe(850000);
  });

  it('residual no último após sort por sequence', () => {
    const result = calculateContractSplit(10003, [
      { sequence: 2, party_type: 'client', party_id: 'b', name: 'B', basis_value: 50 },
      { sequence: 1, party_type: 'client', party_id: 'a', name: 'A', basis_value: 50 },
    ], {});
    expect(result[0].sequence).toBe(1);
    expect(result[1].amount_cents).toBe(5002);
    expect(result.reduce((s, i) => s + i.amount_cents, 0)).toBe(10003);
  });

  it('basis zero com 2 pagadores → SplitBasisZeroError', () => {
    expect(() =>
      calculateContractSplit(850000, [
        { sequence: 1, party_type: 'client', party_id: 'a', name: 'A', basis_value: 0 },
        { sequence: 2, party_type: 'client', party_id: 'b', name: 'B', basis_value: 0 },
      ], {})
    ).toThrow(SplitBasisZeroError);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/__tests__/contract-split.test.ts
```

- [ ] **Step 3: Implement `src/lib/contract-split.ts`**

Algoritmo spec §5: sort ASC → override ou proporcional via `splitFreightProportional(totalValueCents/100, basis)` → centavos → residual em último → `calculated_at` igual em todos.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/contract-split.test.ts
```

- [ ] **Step 5: Copy to Edge shared**

Duplicar arquivo em `supabase/functions/_shared/contract-split.ts` (import relativo `./cte-nfe-split.ts`).

---

### Task 3: CTR code suffix + renderer per-leg amount

**Files:**
- Modify: `src/lib/canonical-doc-ref.ts`
- Modify: `src/lib/__tests__/canonical-doc-ref.test.ts`
- Modify: `supabase/functions/generate-contract-pdf/contract-clause-helpers.ts`
- Modify: `supabase/functions/generate-contract-pdf/contract-renderer.ts`

**Interfaces:**
- Produces: `ctrCodeFromQuoteCode('COT-2026-08-0003', 1)` → `'CTR-2026-08-0003-01'`
- Produces: `renderContractPdf({ …, splitItem, partyRecord, amount_cents })` — cláusula 5.1 usa `amount_cents`, não `quote.value`

- [ ] **Step 1: Extend `ctrCodeFromQuoteCode`**

```typescript
export function ctrCodeFromQuoteCode(
  quoteCode: string | null | undefined,
  sequence?: number
): string {
  const base = /* existing COT→CTR logic */;
  if (sequence == null || sequence < 1) return base;
  return `${base}-${String(sequence).padStart(2, '0')}`;
}
```

Espelhar em `contract-clause-helpers.ts`.

- [ ] **Step 2: Update renderer**

Em `renderContractPdf`, aceitar `splitItem` + `partyOverride`. Substituir:

```typescript
const freightValue = formatBrlReais(amount_cents / 100);
```

Adicionar sub-frase 5.1: parcela na cotação `COT-…` (não repetir total operação).

- [ ] **Step 3: Run existing contract tests**

```bash
npx vitest run supabase/functions/generate-contract-pdf/__tests__/
```

Ajustar fixtures se quebrarem.

---

### Task 4: Edge `generate-contract-pdf` multi + partial response

**Files:**
- Modify: `supabase/functions/generate-contract-pdf/index.ts`
- Test: extend smoke or add `supabase/functions/generate-contract-pdf/__tests__/multi-payer.test.ts` (mock storage)

**Interfaces:**
- Consumes: RPC `lock_quote_for_contract`, `calculateContractSplit`, `renderContractPdf`
- Produces response shape:

```typescript
type GenerateContractResponse = {
  contract_id: string | null;
  partial: boolean;
  timeout: boolean;
  success_count: number;
  failed_sequences: number[];
  errors: Array<{ sequence: number; message: string }>;
  contracts: Array<{ contract_id; sequence; pdf_file_name; pdf_storage_path; version; signed_url; already_existed }>;
};
```

- [ ] **Step 1: Refactor index.ts**

1. Parse body `{ quote_id, force_regenerate?, sequence?, quote_updated_at? }`.
2. `const { data: [quote] } = await sb.rpc('lock_quote_for_contract', { p_quote_id: quote_id })`.
3. Validar stage, `quote_updated_at`, splits (recalc se vazio).
4. Loop `targetSequences` com `TIMEOUT_MS = 40_000`.
5. Por iteração: render → upload → insert com novas colunas → `pdfBytes = null`.
6. Montar 200 parcial ou 500 só se `contracts.length === 0 && errors.length > 0`.

Detectar OOM: `err.message` match `/memory|OOM|resource/i` → incluir hint em `errors[].message`.

- [ ] **Step 2: Deploy function (CI ou manual quando humano pedir)**

```bash
npx supabase functions deploy generate-contract-pdf
```

---

### Task 5: Workflow orchestrator partial handling

**Files:**
- Modify: `supabase/functions/workflow-orchestrator/index.ts` (~line 110)

- [ ] **Step 1: Update ganho handler**

```typescript
const contractRes = await callEdgeFunction('generate-contract-pdf', { quote_id: event.entity_id });
if (contractRes?.partial) {
  actions.push(`contract_partial:failed=${contractRes.failed_sequences?.join(',')}`);
} else if (contractRes?.success_count > 0) {
  actions.push(`contracts_generated:${contractRes.success_count}`);
}
```

Não marcar evento como failed se `success_count > 0`.

---

### Task 6: QuoteForm — persist splits + local validation

**Files:**
- Modify: `src/components/forms/QuoteForm.tsx`
- Modify: `src/components/forms/quote-form/steps/IdentificationStep.tsx`
- Modify: `src/components/forms/quote-form/steps/ReviewStep.tsx`

- [ ] **Step 1: Add fields to schema**

Por destinatário (FOB) / embarcador adicional (CIF): `weight_kg`, `cargo_value` (reais), opcional `override_amount` (líquido da perna).

- [ ] **Step 2: Before save — local validation**

```typescript
if (isFracionado && payerCount > 1 && !hasOverride) {
  const basisSum = payers.reduce((s, p) => s + Math.max(p.weight_kg ?? 0, p.cargo_value ?? 0), 0);
  if (basisSum === 0) {
    toast.error('Informe peso ou valor da carga por pagador');
    return;
  }
}
```

- [ ] **Step 3: On save — compute and persist**

```typescript
const contract_splits = calculateContractSplit(
  Math.round(negotiatedValue * 100),
  buildSplitInputsFromForm(data),
  { isOverride: hasManualTotals }
);
quoteData.contract_splits = contract_splits;
```

- [ ] **Step 4: ReviewStep table**

Mostrar pagador + valor + soma vs total.

---

### Task 7: Hooks + QuoteContractPanel multi-line

**Files:**
- Modify: `src/hooks/useQuoteContract.ts`
- Modify: `src/components/modals/quote-detail/QuoteContractPanel.tsx`
- Modify: `src/components/modals/QuoteDetailModal.tsx` (pass `updated_at`)

- [ ] **Step 1: Replace `useQuoteContract` single with list**

Query: all rows for `quote_id`, order `sequence ASC, version DESC`, dedupe in JS keeping first per sequence.

- [ ] **Step 2: Mutate with partial handling**

```typescript
const res = await invokeEdgeFunction('generate-contract-pdf', {
  body: { quote_id, force_regenerate: force, sequence, quote_updated_at: quote.updated_at },
});
if (res.partial) {
  toast.warning(`Contratos parciais. Falta: ${res.failed_sequences.join(', ')}`);
}
```

OOM hint: se error message contém memory → toast “Re-emita um contrato por vez”.

- [ ] **Step 3: Panel UI**

Map `contract_splits` expected vs generated. Card por sequence com valor, ações, banner soma.

---

### Task 8: Financial `has_contract` view + smoke manual

**Files:**
- Create: `supabase/migrations/20260817180100_financial_has_contract_multi_payer.sql`
- Manual: `COT-2026-08-0003`

- [ ] **Step 1: Update lateral join in view**

`has_contract` = todas sequences esperadas (`jsonb_array_length(contract_splits)`) têm PDF latest:

```sql
left join lateral (
  select
    count(distinct qc.sequence) filter (where qc.pdf_storage_path is not null) >=
      greatest(1, coalesce(jsonb_array_length(q.contract_splits), 0)) as has_contract,
    max(qc.pdf_storage_path) filter (where qc.sequence = 1) as contract_pdf_path
  from (
    select distinct on (sequence) sequence, pdf_storage_path
    from public.quote_contracts
    where quote_id = k.source_id
    order by sequence, version desc
  ) qc
) qc on true
```

(Ajustar SQL exato ao testar — objetivo: `has_contract` false se só 1 de 2 CTRs existe.)

- [ ] **Step 2: Manual smoke âncora**

1. Cotação FOB 2 destinos, override 3700 + 4800, total 8500.
2. Marcar Ganha → 2 PDFs.
3. Painel lista `-01` Icaro e `-02` Iron.
4. Cláusula 5.1 com valores corretos.

```bash
npx vitest run src/lib/__tests__/contract-split.test.ts src/lib/__tests__/canonical-doc-ref.test.ts
npx tsc --noEmit
```

---

## Plan self-review

| Spec requirement | Task |
|---|---|
| FOB pagadores = destinatários | Task 2 `resolveContractPayers`, Task 6 form |
| Fracionado peso/valor + override 3700/4800 | Task 2 tests, Task 6 |
| Lotação km rateio | Task 2 `basis: lotacao_km` branch |
| `sequence ASC` residual | Task 2 |
| `sum(basis)===0` → 409 | Task 2, Task 6 |
| ENUM party_type | Task 1 |
| RPC FOR UPDATE | Task 1, Task 4 |
| 200 partial, timer 40s | Task 4 |
| Memory GC per iteration | Task 4 |
| CTR `-01` filename | Task 3 |
| Ganha gera todos | Task 4, Task 5 |
| Re-emit por sequence | Task 4, Task 7 |
| Lifecycle storage PR seguinte | Documented in spec §12.1 only |

No TBD in plan. Commits deferred per user rule.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-17-multi-payer-contracts.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints

**Which approach?**

**Recommended start order if inline:** Task 1 (migration) → Task 2 (split + tests) → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8.
