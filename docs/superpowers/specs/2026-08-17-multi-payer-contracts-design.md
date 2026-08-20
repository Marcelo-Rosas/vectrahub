# Design — Contratos multi-pagador (CIF/FOB)

**Data:** 2026-08-17  
**Repo:** `vectra-hub`  
**Status:** aprovado para implementação (review técnico 2026-08-17; sign-off final 2026-08-17)  
**Plano:** `docs/superpowers/plans/2026-08-17-multi-payer-contracts.md`  
**Caso âncora:** `COT-2026-08-0003` (FOB, fracionado, 2 destinatários)  
**Brainstorm:** sessão 2026-08-17

---

## 1. Problema

Hoje 1 cotação = 1 contrato. `generate-contract-pdf` resolve um único CONTRATANTE:

- CIF → embarcador principal (`shippers`)
- FOB → cliente principal (`clients`)

Ignora `additional_shippers` e destinatários extras (`quote_route_stops` / `additional_recipients`).

`COT-2026-08-0003` gerou `CTR-2026-08-0003` só para ICARO ONOFRE, CNPJ vazio, valor cheio da cotação. Iron Bukler não recebeu instrumento. Soma comercial correta (com desconto) é:

| Pagador (FOB) | Valor líquido |
|---|---|
| Iron Bukler | R$ 4.800,00 |
| Icaro Onofre | R$ 3.700,00 |
| **Total** | **R$ 8.500,00** |

Embarcadores cadastrados em `Shippers` **não** são pagadores neste caso (FOB).

## 2. Objetivo

1. Gerar **1 contrato por pagador**, não por perna remetente×destino.
2. Pagador vem do `freight_type` da cotação (um só tipo, não por perna).
3. Persistido o cálculo por pagador. Soma das pernas = `quotes.value`.
4. Ao marcar **Ganha**, emitir todos os PDFs. Painel lista. Re-emitir é por contrato.
5. Código: `CTR-AAAA-MM-####-NN` + slug do pagador no arquivo.

## 3. Decisões travadas (brainstorm)

| Tema | Decisão |
|---|---|
| Eixo do split | Pagador, não cartesiano rem×dest |
| FOB | 1 CTR por destinatário (cliente principal + adicionais). Embarcador **não** entra |
| CIF | 1 CTR por remetente (embarcador principal + `additional_shippers`). Destinatário **não** entra |
| 1 pagador | 1 CTR, ainda com sufixo `-01` (padrão único) |
| Fracionado | Rateio por peso/valor da carga, **já com desconto**. Caso âncora: Iron 4.800 + Icaro 3.700 |
| Lotação | Rateio por km de cada destino (`quote_route_stops.planned_km_from_prev`). Residual na última perna |
| Numeração | `CTR-2026-08-0003-01`, `-02`. Arquivo: `CTR-2026-08-0003-01-ICARO_ONOFRE.pdf` |
| Gatilho | Stage `ganho` gera **todos**. Re-emitir manda `sequence` |
| Persistência | Estender `quote_contracts` + gravar `quotes.contract_splits` no save |
| Falha parcial | HTTP **200** + payload (`partial`, `failed_sequences`). Nunca 500 se alguma perna subiu |
| Timeout Edge | Orçamento 40s no loop; estouro → 200 parcial; client pede as sequences faltantes |
| Concorrência | `SELECT … FOR UPDATE` na cotação + `quote_updated_at` no body |
| Storage legado | Lifecycle/cron documentado agora; script de limpeza = **PR subsequente** |
| Assinatura GOV.br | Fora de escopo (botão “em breve”) |
| CIF/FOB por perna | Fora de escopo (`freight_type` único na cotação) |

## 4. Modelo de dados

Moeda nova em **centavos inteiros**. `quotes.value` hoje é `numeric` em reais. Conversão na borda: `amount_cents = round(value * 100)`. Comparação de soma usa centavos.

### 4.1 `quotes.contract_splits` (jsonb, default `[]`)

Gravado no save da cotação. Fonte da verdade **antes** do Ganha.

```json
[
  {
    "sequence": 1,
    "party_type": "client",
    "party_id": "<uuid>",
    "name": "ICARO ONOFRE",
    "amount_cents": 370000,
    "basis": "fracionado_peso_valor",
    "weight_kg": 0,
    "cargo_value_cents": 0,
    "km": null,
    "calculated_at": "2026-08-17T21:00:00.000Z"
  },
  {
    "sequence": 2,
    "party_type": "client",
    "party_id": "<uuid>",
    "name": "IRON BUKLER",
    "amount_cents": 480000,
    "basis": "fracionado_peso_valor",
    "weight_kg": 0,
    "cargo_value_cents": 0,
    "km": null,
    "calculated_at": "2026-08-17T21:00:00.000Z"
  }
]
```

- FOB → `party_type: "client"`. CIF → `party_type: "shipper"`.
- `basis`: `fracionado_peso_valor` | `lotacao_km`.
- `calculated_at`: ISO-8601 UTC, **igual em todos os itens** da mesma computação (auditoria do rateio).
- Ordem canônica: pagador principal = `sequence` 1; adicionais na ordem do form = 2, 3… Antes de persistir e antes do residual, **ordenar `sequence ASC`**.
- Invariante: `sum(amount_cents) === round(quotes.value * 100)`. Residual (centavo) no elemento `splits[splits.length - 1]` **depois** do sort.
- Valores do split são **líquidos** (desconto já aplicado). Não reaplicar `discount_value` no PDF.

### 4.2 Peso/valor por pagador (buraco atual)

Destinatário extra hoje só tem `client_id` + `name`. Sem isso o rateio fracionado não reproduz 3.700/4.800.

- Form: cada destinatário/remetente pagador ganha `weight_kg` e `cargo_value` (reais no form → centavos no JSON).
- Persistência: `quote_route_stops.metadata` (`client_id`, `weight_kg`, `cargo_value_cents`) e, em CIF, os mesmos campos em cada item de `additional_shippers`.
- Lotação: usa `planned_km_from_prev` (já existe). Não exige peso.

Fracionado com 2+ pagadores: se `sum(basis_values) === 0` (todos `weight_kg` e `cargo_value` nulos/zero, sem override de totais) → **409**. QuoteForm valida **antes** da rede (ver 8.2). Edge recusa igual.

### 4.3 `quote_contracts` — colunas novas

| Coluna | Tipo | Nota |
|---|---|---|
| `sequence` | `int NOT NULL DEFAULT 1` | `CHECK (sequence >= 1)` → sufixo `-01` `-02` |
| `party_type` | `quote_contract_party_type NOT NULL` | ENUM Postgres: `'client'` \| `'shipper'` (não `text`) |
| `party_id` | `uuid` | FK lógica (clients ou shippers conforme `party_type`) |
| `amount_cents` | `int NOT NULL` | cláusula 5.1; `CHECK (amount_cents >= 0)` |
| `split_snapshot` | `jsonb NOT NULL DEFAULT '{}'` | cópia do item + `freight_type` + `basis` |

```sql
CREATE TYPE public.quote_contract_party_type AS ENUM ('client', 'shipper');

CREATE UNIQUE INDEX quote_contracts_quote_id_sequence_version_key
  ON public.quote_contracts (quote_id, sequence, version);

-- Leitura do painel: latest por sequence sem seq scan
CREATE INDEX idx_quote_contracts_latest
  ON public.quote_contracts (quote_id, sequence, version DESC);
```

Painel: `WHERE quote_id = $1 ORDER BY sequence ASC, version DESC` e dedup por `sequence`. Não usar `limit 1` global.

Backfill: linhas existentes → `sequence = 1`, `party_type`/`party_id`/`amount_cents` a partir do CONTRATANTE atual e `quotes.value`. `split_snapshot = {}`. Essas linhas são **legado de valor cheio** se a cotação passar a ter 2+ pagadores.

### 4.4 Legado

CTR sem sufixo (ex.: `CTR-2026-08-0003` valor cheio) **não** é apagado do storage. Próximo Ganha/gerar-todos cria `-01` e `-02`. Painel lista só latest por `sequence` das linhas novas (`split_snapshot` não vazio **ou** cotação com `contract_splits.length >= 1` alinhado). Linha velha de valor cheio some da lista quando existem sequences do split atual.

## 5. Cálculo do split

Função pura compartilhada (client + Edge), testes unitários obrigatórios.

**Pagadores**

```text
FOB → [cliente principal, ...additional_recipients com client_id]
CIF → [embarcador principal, ...additional_shippers com shipper_id]
```

FOB **nunca** inclui shipper. CIF **nunca** inclui client como pagador.

Algoritmo (ordem fixa):

1. Montar array de pagadores com `sequence` 1..N.
2. `splits.sort((a, b) => a.sequence - b.sequence)`.
3. Calcular `basis_values[]` (fracionado ou km).
4. Se **não** houver override de totais líquidos **e** `sum(basis_values) === 0` → throw 409 (`split_basis_zero`).
5. `splitFreightProportional` (ou override). Converter para `amount_cents`.
6. Residual: ajustar **somente** `splits[splits.length - 1]` (já ordenado por `sequence ASC`) para `sum === round(quotes.value * 100)`.
7. Stamp `calculated_at = new Date().toISOString()` em **todos** os itens.

**Fracionado** (`freight_modality === 'fracionado'` ou `basis` da tabela):

- Peso de rateio por pagador = `max(weight_kg, cargo_value)` se os dois existirem; se só um, usa o que tem (o outro conta 0).
- Caso âncora (Iron 4.800 / Icaro 3.700): override de totais líquidos no form — persistir direto, conferir soma, **não** exige `sum(weight) > 0`.
- Sem override: `splitFreightProportional(quoteValueReais, basis_values)`. Resultado × 100 → `amount_cents`.
- Desconto: `quotes.value` já é líquido. Split sobre `quotes.value`, não sobre bruto.

**Lotação:**

- `basis_values` = km de cada destino (`planned_km_from_prev`; destino final = km do último trecho). Mesmo critério do CT-e.
- `sum(kms) === 0` → 409 (`split_basis_zero`).
- `splitFreightProportional(quoteValueReais, kms)`. Residual no último após sort.

**1 pagador:** um item, `amount_cents = round(quotes.value * 100)`, `sequence = 1`. Sem rateio; `sum(basis) === 0` **não** bloqueia.

## 6. Edge `generate-contract-pdf`

### 6.1 Body

```ts
{
  quote_id: string;
  force_regenerate?: boolean;
  sequence?: number;
  /** ISO de `quotes.updated_at` visto pelo client. Se divergir → 409. */
  quote_updated_at?: string;
}
```

- Sem `sequence` → todos os itens de `contract_splits` (já `sequence ASC`).
- Com `sequence` → só aquela perna (re-emitir).

### 6.2 Fluxo

1. `SELECT … FROM quotes WHERE id = $1 FOR UPDATE`. Sem row → 404. `stage !== 'ganho'` → 400.
2. Se body tem `quote_updated_at` e ≠ `quotes.updated_at` (ISO) → **409** `quote_changed`. Client refetch e retry.
3. Ler `contract_splits`. Vazio → recalcular (regras da §5, sort `sequence ASC`), `UPDATE quotes.contract_splits`, seguir. Soma ≠ value ou `split_basis_zero` → **409**, nenhum PDF.
4. Resolver cadastro por `party_id` (CNPJ, endereço, representante). Sem cadastro → PDF com `[CNPJ não informado]`; **não** bloqueia emissão (instrumento particular; operador completa cadastro antes de mandar ao cliente). Client: toast **`warning`**, não `info`.
5. Loop das sequences alvo. `startedAt = Date.now()`. **Antes** de renderizar a próxima perna: se `Date.now() - startedAt > 40_000` → para o loop, devolve 200 parcial (`timeout: true`). Limite prático Supabase Edge ~50s; folga 10s pro último upload.
6. Sem `sequence` no body: para cada item, se existe linha não-legado da sequence e `force_regenerate=false` → reusa (não conta no timer de render). Senão render + upload + insert.
7. Com `sequence`: idem, 1 PDF. `version = max(version da sequence) + 1`. Outras pernas intactas. Sequence inexistente no split → 404.
8. Renderer recebe quote + company + version + **split item** + **party record**.
9. Path: `contracts/{quote_id}/{sequence}/v{version}-{timestamp}.pdf`.
10. Filename (decisão do brainstorm, **sem** `-vN`): `CTR-2026-08-0003-01-ICARO_ONOFRE.pdf`. Versão só no PDF, no registro e no path do Storage.

`workflow-orchestrator` no `ganho` continua `{ quote_id }` (todos).

### 6.3 Resposta

HTTP **200** sempre que a função completar o loop (sucesso total, parcial ou timeout). **Não** usar 500 para falha de uma perna. **Não** usar 207: `invokeEdgeFunction` + orquestrador já tratam 200 JSON; 207 exigiria ramo extra sem ganho.

```ts
{
  contract_id: string | null; // primeiro sucesso (compat orquestrador); null se nenhum
  partial: boolean;
  timeout: boolean;
  success_count: number;
  failed_sequences: number[];
  errors: Array<{ sequence: number; message: string }>;
  contracts: Array<{
    contract_id: string;
    sequence: number;
    pdf_file_name: string;
    pdf_storage_path: string;
    version: number;
    signed_url: string | null;
    already_existed: boolean;
  }>;
}
```

- Tudo ok → `partial: false`, `failed_sequences: []`.
- Uma perna falhou ou timeout → `partial: true`, `contracts` = as que subiram, `failed_sequences` = as que faltam. Client **não** trata como erro fatal: refetch lista e dispara `sequence` só das falhas. Não invalida PDFs já gerados.
- Nenhuma perna gerada e havia trabalho (erro duro: storage down, quote lock) → **500** + `{ error }` sem `contracts`. Distinto de parcial.

`workflow-orchestrator`: se `partial`, loga `failed_sequences`; **não** marca o evento como falha total se `success_count > 0`.

## 7. PDF

- Título: `Nº CTR-2026-08-0003-01 — ICARO ONOFRE — Versão N`
- CONTRATANTE = cadastro daquela parte. FOB: sem texto “embarcador/remetente”. CIF: mantém qualificação de embarcador.
- Cláusula 5.1 = `formatBrlReais(amount_cents / 100)` **da perna**.
- Frase em 5.1: este instrumento cobre a parcela do CONTRATANTE na cotação `COT-…`. Não repetir o total da operação como dívida deste PDF.
- Cláusula 5.3: 70/30 (ou condição da cotação) sobre **o valor da perna**. Mesmas datas `advance_due_date` / `balance_due_date`.
- Rodapé: `Ref. CTR-2026-08-0003-01 — ICARO ONOFRE vN`
- `resolveContractContratante` passa a aceitar override `{ party, name, source }` do split. Sem split/1 pagador: comportamento atual.

## 8. UI

### 8.1 `QuoteContractPanel`

- Stage ≠ `ganho`: texto atual (“emitido quando Ganha”).
- Stage `ganho`: uma linha por sequence (latest version).
  - Código + razão social
  - Valor `R$ X.XXX,00`
  - Versão + `signature_status`
  - Visualizar / Baixar / Re-emitir (`sequence`)
- Topo: soma das pernas vs `quotes.value`. Igual → ok. Diferente → alerta.
- PDF faltando (falha parcial / timeout): linha “não gerado” + botão Gerar (`sequence`). Hook **não** dispara retry automático no 200 `partial`.
- Hook `useQuoteContracts(quoteId)` → array. `useGenerateContract` aceita `{ force, sequence?, quote_updated_at }`. Se `partial: true`, toast warning + gera só `failed_sequences`.

### 8.2 QuoteForm

- Campos `weight_kg` e `cargo_value` por destinatário (FOB) / embarcador adicional (CIF) quando houver 2+ pagadores **e** modalidade fracionado.
- Save persiste `contract_splits`.
- Review: tabela Icaro 3.700 / Iron 4.800 / soma 8.500.
- Bloqueio **local, antes da rede** (evita 409):
  - Fracionado, 2+ pagadores, sem override de totais: se `sum(max(weight_kg, cargo_value)) === 0` → `toast.error`, `return` (não chama update).
  - Com override: se soma dos totais ≠ `quotes.value` → mesmo bloqueio.
  - Edge replica a mesma regra (defesa).

Financeiro (`FinancialCard` / `has_contract`): verdadeiro se **todas** as sequences do split têm PDF latest. Senão “parcial” / “sem contrato”.

## 9. Erros

| Caso | HTTP / UI |
|---|---|
| Soma split ≠ value | 409; painel mostra os dois números |
| `sum(basis_values) === 0` (2+ pagadores, sem override) | QuoteForm bloqueia local; Edge 409 `split_basis_zero` |
| `quote_updated_at` divergente | 409 `quote_changed`; refetch |
| `party_id` sem cadastro | PDF com placeholder; toast **warning** |
| Stage ≠ ganho | 400 |
| Falha/timeout 1+ pernas, outras ok | **200** `partial: true` + `failed_sequences` |
| Nenhuma perna e erro duro | 500 |
| Re-emitir sequence fora do split | 404 |

## 10. Testes

- `resolveContractPayers`: FOB 2 dest → 2 clients; CIF 2 shippers → 2 shippers; FOB não inclui shipper.
- Rateio: `sum(basis) === 0` → erro; sort `sequence ASC` antes do residual; residual só em `splits.at(-1)`.
- Rateio fracionado: totais 370000 + 480000 = 850000.
- Rateio lotação: kms somam o total; residual na última após sort.
- Concorrência: `quote_updated_at` velho → 409.
- Resposta parcial: 200 + `partial: true` + `failed_sequences`.
- `ctrCodeFromQuoteCode('COT-2026-08-0003', 1)` → `CTR-2026-08-0003-01`.
- Renderer: 5.1 usa `amount_cents` da perna, não `quotes.value`.
- Query: latest version **por sequence**.
- Smoke: 2 PDFs, filenames canônicos, valores 3.700 e 4.800.

Caso âncora de verificação manual: re-emitir `COT-2026-08-0003` após Ganha e conferir os 2 CTRs.

## 11. Fora de escopo

- Envelope de assinatura digital.
- `freight_type` distinto por destinatário/remetente.
- Contrato contra embarcador em operação FOB.
- Recalcular `quotes.value` (8.530 vs 8.500): split usa o `value` persistido; se o valor da cotação ainda for 8.530, o operador corrige a cotação **antes** — a Edge não inventa 8.500.
- Código do cron `cleanup-contract-pdfs` **neste** PR (regra documentada em §12.1; implementação = PR subsequente).

## 12. Arquivos tocados (previsto)

- `supabase/migrations/` — ENUM `quote_contract_party_type`, colunas `quote_contracts`, `quotes.contract_splits`, unique + `idx_quote_contracts_latest`
- `supabase/functions/generate-contract-pdf/` — index, helpers, renderer, testes, timer 40s, `FOR UPDATE`
- `supabase/functions/workflow-orchestrator/index.ts` — trata `partial` / `failed_sequences`
- `src/lib/canonical-doc-ref.ts` — sufixo `-NN`
- `src/hooks/useQuoteContract.ts` — lista + mutate com sequence + `quote_updated_at`
- `src/components/modals/quote-detail/QuoteContractPanel.tsx`
- `src/components/forms/QuoteForm.tsx` + `IdentificationStep` + `ReviewStep` (validação local `sum(basis) > 0`)
- `src/lib/cte-nfe-split.ts` — reuso `splitFreightProportional` (não duplicar)
- Tipos gerados após migration

### 12.1 Lifecycle de Storage (requisito agora, código no PR seguinte)

Supabase Storage **não** tem lifecycle S3 nativo no bucket `documents`. Regra obrigatória a documentar e implementar em PR subsequente (`cleanup-contract-pdfs` semanal, cron ou Edge agendada):

1. Para cada par `(quote_id, sequence)`: manter só o objeto da **maior** `version` em `quote_contracts`.
2. Apagar do bucket os `pdf_storage_path` das versões menores.
3. Após existirem sequences do split atual (`-01`, `-02`…), apagar objetos de CTR legado (path `contracts/{quote_id}/v*-*.pdf` sem pasta `/{sequence}/`).
4. **Não** apagar a linha `quote_contracts` (histórico/assinatura); só o blob.

Até o PR de limpeza: re-emissão acumula arquivos. Aceito como dívida **datada**, não esquecida.

---

## Self-review

- Sem TBD. 8.530 vs 8.500 resolvido: fonte = `quotes.value`; correção comercial é na cotação.
- Override de totais líquidos no form permitido para reproduzir 4.800/3.700 sem adivinhar peso; override **dispensa** `sum(basis) > 0`.
- Residual só depois de `sort(sequence ASC)` → `splits.at(-1)` determinístico.
- Falha parcial = 200 estruturado (não 500, não 207) por causa de `invokeEdgeFunction`.
- Filename **sem** `-vN`. Path Storage continua versionado.
- `party_type` = ENUM Postgres.
- CNPJ ausente: emite + toast **warning** (legalidade = instrumento particular; cadastro antes de enviar ao cliente).

---

## Apêndice A — Migration SQL (idempotente)

Script canônico para o PR. **Não** usar coluna `contractor_id` (não existe). Backfill deriva `party_id` de `quotes.freight_type` + `client_id` / `shipper_id`.

```sql
-- ENUM
DO $$ BEGIN
  CREATE TYPE public.quote_contract_party_type AS ENUM ('client', 'shipper');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- quote_contracts
ALTER TABLE public.quote_contracts
  ADD COLUMN IF NOT EXISTS sequence int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS party_type public.quote_contract_party_type NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS party_id uuid,
  ADD COLUMN IF NOT EXISTS amount_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS split_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.quote_contracts ADD CONSTRAINT check_sequence_positive CHECK (sequence >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.quote_contracts ADD CONSTRAINT check_amount_cents_nonneg CHECK (amount_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contract_splits jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.quotes ADD CONSTRAINT check_contract_splits_is_array
    CHECK (jsonb_typeof(contract_splits) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS public.quote_contracts_quote_id_sequence_version_key;
CREATE UNIQUE INDEX quote_contracts_quote_id_sequence_version_key
  ON public.quote_contracts (quote_id, sequence, version);

DROP INDEX IF EXISTS public.idx_quote_contracts_latest;
CREATE INDEX idx_quote_contracts_latest
  ON public.quote_contracts (quote_id, sequence, version DESC);

-- Backfill legado (party_id de quotes, não contractor_id)
UPDATE public.quote_contracts qc
SET
  sequence = 1,
  party_type = CASE WHEN upper(coalesce(q.freight_type, 'FOB')) = 'CIF' THEN 'shipper'::public.quote_contract_party_type ELSE 'client'::public.quote_contract_party_type END,
  party_id = CASE WHEN upper(coalesce(q.freight_type, 'FOB')) = 'CIF' THEN q.shipper_id ELSE q.client_id END,
  amount_cents = ROUND(COALESCE(q.value, 0) * 100)::int,
  split_snapshot = '{}'::jsonb
FROM public.quotes q
WHERE q.id = qc.quote_id
  AND qc.party_id IS NULL;
```

RPC de lock (Supabase JS não expõe `FOR UPDATE` direto):

```sql
CREATE OR REPLACE FUNCTION public.lock_quote_for_contract(p_quote_id uuid)
RETURNS SETOF public.quotes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
$$;
```

## Apêndice B — Resiliência Edge (memória)

- Loop sequencial de PDFs acumula buffer (~150MB limite Deno). Após cada upload+insert: `pdfBytes = null` (ou bloco `{ … }` por iteração) para GC.
- Erro OOM em `failed_sequences` → UI toast: re-emitir **uma sequence por vez**, não “Gerar todos”.

## Apêndice C — Ordem de execução do PR

1. **Fase 1:** Migration + RPC lock + backfill + regen types  
2. **Fase 2:** `contract-split.ts` + testes (client + `_shared`)  
3. **Fase 3:** `generate-contract-pdf` + `workflow-orchestrator`  
4. **Fase 4:** QuoteForm + QuoteContractPanel + hooks + view `has_contract`
