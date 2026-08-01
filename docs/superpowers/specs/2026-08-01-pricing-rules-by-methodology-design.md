# Design — Unificar regras de precificação por metodologia

**Data:** 2026-08-01  
**Repo:** `vectra-hub`  
**Status:** aprovado — plano em `docs/superpowers/plans/2026-08-01-pricing-rules-by-methodology.md`  
**Plano origem:** `docs/superpowers/plans/2026-08-01-pricing-rules-by-methodology.md`  
**Brainstorm:** sessão 2026-08-01 (fracionado parceiro / RVL → methodology como pré-req)

---

## 1. Problema

- Duas fontes editáveis: `pricing_rules_config` e `pricing_parameters` (overlap `das` / `overhead` / `markup`).
- Edge `buildDynamicFreightParams` e QuoteForm divergem na resolução de margem.
- `price_tables.modality` só distingue `lotacao` | `fracionado` — não separa **NTC (emissão Hub)** de **parceiro (repasse, sem emissão Hub)**.
- Regras não têm escopo por metodologia; “global” comercial mascara packs distintos.

## 2. Objetivo

1. **Uma fonte de verdade** financeira/comercial: `pricing_rules_config`.
2. **Três metodologias:** `lotacao` | `fracionado_ntc` | `fracionado_parceiro`.
3. QuoteForm: trocar tabela → methodology → pack de regras (sem passo manual inconsistente).
4. Fiscal Hub **somente** onde há emissão de documentação pela Vectra HUB.
5. Fundação para spec irmã (motor B+C parceiro / RVL / comparativo) — **fora** deste design.

## 3. Decisões travadas (brainstorm)

| Tema | Decisão |
|---|---|
| Ordem | Methodology **antes** da spec parceiro/RVL |
| Forms / DB | Mesmo `QuoteForm` + `quotes`; **sem** schema/forms separados |
| Entrada no modo | Via `price_tables.methodology` (não toggle solto) |
| Unique | `(key, vehicle_type_id, methodology) NULLS NOT DISTINCT` |
| Global comercial | **Deprecado** — toda regra comercial exige `methodology` |
| `vehicle_type_id` | Permitido em `lotacao` e `fracionado_ntc`; escopo fixado no contexto da cotação (tabela + veículo — mesmo espírito de `QuoteModalLogisticsGrid`) |
| Fiscal | Só `lotacao` + `fracionado_ntc` (Hub emite). **Não** seedar fiscal em `fracionado_parceiro` |
| Margem parceiro | Key dedicada; Central de Regras + **override na cotação**; resolve em `_shared/pricing-rules.ts` |
| Motor parceiro B+C | Spec seguinte: `preço = custo_RVL × (1+margem%)`; sem custos de emissão; UI comparativa NTC×RVL |

## 4. Modelo de dados

### 4.1 `price_tables.methodology`

```text
lotacao | fracionado_ntc | fracionado_parceiro
```

- NOT NULL após backfill.
- `modality` permanece (compat):  
  - `lotacao` → `lotacao`  
  - `fracionado_ntc` | `fracionado_parceiro` → `fracionado`
- Backfill Hub:
  - NTC Fracionado Dez/25 → `fracionado_ntc`
  - Referencial Dez 2025 → `lotacao`
  - ANTT (fracionado) → `fracionado_ntc`
  - Futura RVL → `fracionado_parceiro`

### 4.2 `pricing_rules_config.methodology`

- `text NOT NULL` para keys comerciais/fiscais de frete (após migração).
- Unique: `(key, vehicle_type_id, methodology) NULLS NOT DISTINCT`.
- Sem linhas comerciais com “global” (`methodology` vazio).

### 4.3 Conteúdo por pack

| Keys | lotacao | fracionado_ntc | fracionado_parceiro |
|---|---|---|---|
| overhead, markup, margens lotação/NTC | sim | sim | — |
| `profit_margin_parceiro_fracionado_percent` | — | — | sim |
| fiscal (regime, DAS, PIS, COFINS, IRPJ, CSLL, UF) | sim | sim | **não** |
| GRIS/TSO defaults de emissão | conforme motor atual | sim | **não** |

Valores fiscais podem ser **espelhados** entre lotacao e fracionado_ntc no seed (mesmo CNPJ emitente).

## 5. Resolve (Edge + client)

### Precedência

```text
1. override cotação (ex. margem parceiro no quote)
2. (key, methodology, vehicle_type_id)
3. (key, methodology, NULL)
4. FREIGHT_CONSTANTS
```

Sem fallback comercial `methodology NULL`.  
`pricing_parameters` fora do path quente a partir da Fase 2 (Fase 5 remove fallback).

### API

```ts
resolvePricingRule(rules, key, { methodology, vehicleTypeId }, fallback?)
resolvePricingRuleBackend(...) // espelho em supabase/functions/_shared/pricing-rules.ts
```

`buildDynamicFreightParams`:

- Input: `methodology` (join `price_tables` via `price_table_id` ou campo explícito).
- Margem:
  - `lotacao` → `profit_margin_lotacao_percent` (fallback legado `profit_margin_percent` só no pack lotacao durante transição)
  - `fracionado_ntc` → `profit_margin_fracionado_percent`
  - `fracionado_parceiro` → `profit_margin_parceiro_fracionado_percent`
- Se `fracionado_parceiro`: não montar params fiscais Hub no path de preço; gancho para motor markup (implementação completa = spec irmã).

## 6. UX

### QuoteForm

- Badge metodologia no select de tabela.
- `price_table_id` change → methodology → `freight_modality` derivado + resolve pack + recalc.
- Pack ativo visível no strip financeiro.
- `fracionado_parceiro`: campo margem (default regra + override); ocultar blocos fiscais/emissão Hub.
- Comparativo NTC×RVL: **não** neste design (spec irmã).

### Central de Regras

Tabs: **Lotação** | **Fracionado NTC** | **Fracionado Parceiro**.  
Sem tab “Global comercial”. Fiscal só nas tabs com emissão.

### Fase 0 / 4 — limpeza

- UI Impostos/Margens que edita overlap em `pricing_parameters` → redirect “edite na Central”.
- Corrigir formatters bool/UF como R$.

## 7. Fases de implementação

| Fase | Entrega |
|---|---|
| 0 | Congelar divergência UI `pricing_parameters` |
| 1 | Schema + backfill + seed 3 packs + types |
| 2 | Resolve unificado client + `pricing-rules.ts` + Edge |
| 3 | QuoteForm badges / troca tabela / margem parceiro (gancho) |
| 4 | Central tabs + limpeza formatters |
| 5 | Remover fallback `pricing_parameters` do path quente |

Não abrir Fase 5 até Fases 2–3 estáveis.

## 8. Erros

- Tabela sem methodology → bloqueia cálculo + mensagem clara.
- Key obrigatória ausente no pack → `FREIGHT_CONSTANTS` + `fallbacksApplied`.
- Parceiro sem margem (regra e override) → erro explícito.
- Troca NTC→Parceiro → limpa breakdown fiscal / recalc.

## 9. Testes

- Unit precedence (vehicle > pack > constant; sem global comercial).
- Unit: parceiro não resolve keys fiscais.
- Smoke Edge: 3 methodologies, mesma carga/km.
- e2e leve: troca tabela → badge + params.

## 10. Critérios de aceite

1. Editar regra só na Central (pack) altera QuoteForm + Edge no próximo calc.
2. Tabela NTC → pack `fracionado_ntc`; Parceiro → `fracionado_parceiro`; Referencial → `lotacao`.
3. Trocar `price_table_id` muda pack sem inconsistência manual de modalidade.
4. Um editor por chave financeira (sem dupla `pricing_parameters`).
5. Fiscal ausente no path `fracionado_parceiro`.
6. Client ≡ Edge no resolve.

## 11. Fora de escopo

- Import planilha RVL.
- Motor B+C completo + painel comparativo NTC×RVL.
- Alterar alíquotas de negócio (só estrutura/packs).
- Drop físico da tabela `pricing_parameters`.
- Emissão CT-e/MDF-e/seguro no fluxo parceiro.

## 12. Relação com fracionado parceiro / RVL

Este design é **pré-requisito**. Spec irmã deve cobrir:

- `preço_venda = custo_tabela_parceiro × (1 + margem%)`
- Zero custos operacionais de emissão Hub
- Dois números + comparação com cotação NTC
- Import/mapeamento planilha RVL → `price_tables` `fracionado_parceiro`

---

## Self-review

- [x] Sem TBD/TODO abertos materiais
- [x] Consistente: fiscal só emissão Hub; unique NULLS NOT DISTINCT documentado
- [x] Escopo focado (methodology); motor B+C isolado em spec irmã
- [x] Ambiguidades resolvidas: sem global comercial; ordem A (methodology first); forms = QuoteForm único
