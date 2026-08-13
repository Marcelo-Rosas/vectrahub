# Prompt — Modelagem TMS Fracionado (LTL) a partir de tabelas de preço

> **Como usar:** colar este prompt em sessão nova (Cursor Agent). Pré-req: MCP `google-drive` autenticado + Supabase Hub `lrbtbrpoklgwaaclbufz` linkado.
> **Data:** 2026-08-01 · Tenant: Vectra HUB

---

## Papel

Você é arquiteto de produto + engenheiro de domínio TMS (Transport Management System) focado em **frete fracionado (LTL)** no Brasil (NTC / tabela por faixa KM × faixa peso). Trabalha no repo `vectra-hub` (Vite/React/Supabase). **Não implemente código até eu aprovar o desenho** (skill brainstorming / writing-plans).

## Objetivo

Modelar (e depois planejar implementação) o fluxo de **cotação / precificação / operação fracionado** da Vectra HUB, partindo das **tabelas de preço já existentes no Hub** e confrontando com a **tabela RVL** (referência de mercado / formato de planilha).

Entregável desta fase: **spec de modelagem** (dados, regras, gaps vs lotação, UX mínima), **não** feature completa.

## Contexto Hub (estado atual — use como fonte da verdade)

### Tabelas já no Supabase Hub

| Recurso | Estado | Notas |
|---|---|---|
| `price_tables` | 3 | `NTC Fracionado Dez/25` (active, modality=`fracionado`, 50 rows c/ weight bands); `Referencial Dez 2025` (lotação); `ANTT` (fracionado, inactive) |
| `price_table_rows` | 150 | Faixas `km_from`–`km_to` + `weight_rate_10..200` + `weight_rate_above_200` + GRIS/TSO/% |
| `ltl_parameters` | 3 | Mínimos NTC (frete min, GRIS min, TSO min, despacho, cubagem, fator correção) |
| `pricing_parameters` / `pricing_rules_config` / `conditional_fees` / `payment_terms` | populados | Clonados do Cargo |
| `pricing_route_overrides` | 3 | Overrides por UF/cidade |

### Código relevante (não reinventar)

- Cálculo LTL: `src/lib/freightCalculator.ts` (seleção `weight_rate_*` por kg; trava 1t; mínimos via `ltlParams`)
- Import planilha: `src/hooks/useImportPriceTable.ts` + Edge `import-price-table` + `src/lib/priceTableParser`
- UI pricing: `src/components/pricing/*` + tipos `src/types/pricing.ts`
- Cotação: `QuoteForm` com `freight_modality: lotacao | fracionado`
- Moeda: **sempre centavos (inteiro)** na persistência; exibir R$ com 2 casas

### O que já existe vs o que falta modelar

**Já existe (base):** tabela NTC fracionado por KM×peso, LTL params, cálculo local + edge `calculate-freight`, flag modalidade na cotação.

**Provável gap (você deve validar):**

1. Import/parser alinhado ao **layout RVL** (colunas, unidades, abas, vigência)
2. Regras comerciais RVL ≠ NTC puro (taxas, mínimos, TDE/TEAR, cubagem, GRIS alto risco)
3. UX cotação fracionado (volumes, cubagem, qtd volumes, multi-destinatário?)
4. Operação pós-aprovação (OC, CT-e fracionado, rateio, consolidação)
5. Diff schema Hub vs necessidades RVL (novas colunas? nova `price_table` “RVL …”?)

## Fonte externa obrigatória — planilha RVL

**URL:** https://docs.google.com/spreadsheets/d/1W8NL2PuX_OmeHKyEyylOi8h5GY9S2e4f/edit?gid=533972825#gid=533972825  
**Spreadsheet ID:** `1W8NL2PuX_OmeHKyEyylOi8h5GY9S2e4f`  
**Aba inicial (gid):** `533972825`

### Como ler (MCP Google Drive)

1. Usar MCP `google-drive` (Sheets) para abrir o spreadsheet pelo ID.
2. Listar **todas as abas** (não só gid 533972825).
3. Extrair cabeçalhos + 5–20 linhas amostra de cada aba relevante a preço/taxa/mínimo.
4. Documentar: unidade (R$/kg, R$/t, %), faixas KM, faixas peso, impostos/taxas embutidas, vigência, notas de rodapé.
5. **Não** gravar dados sensíveis de cliente no repo; só estrutura + exemplos anonimizados se necessário.

Se MCP Drive falhar: pedir export CSV/XLSX local e continuar.

## Escopo da modelagem (perguntas a responder)

### A. Domínio de preço

1. RVL é **referência de mercado** (benchmark), **tabela a importar** para Hub, ou **ambos**?
2. Mapeamento RVL → modelo Hub:
   - `price_tables` + `price_table_rows.weight_rate_*` é suficiente?
   - Ou precisa matriz alternativa / JSONB / tabela nova?
3. Como RVL trata: cubagem, frete mínimo, GRIS, TSO/despacho, pedágio, TDE/TEAR, retorno, agendamento?
4. Compatibilidade com `ltl_parameters` e `conditional_fees` atuais.

### B. Fluxo TMS fracionado (produto)

Mapear SIPOC leve (ou estágios) só do fracionado:

`lead/cotação → aprovação → coleta → consolidação? → CT-e → entrega → POD → fatura`

Para cada estágio: o que muda vs lotação no Hub hoje.

### C. UX / módulos

Mínimo viável fracionado no Hub:

- Cadastro/import tabela estilo RVL
- Simulador frete (já em `FreightSimulator`?)
- Cotação com peso/cubagem/volumes
- (Opcional fase 2) consolidação de cargas

### D. Não-objetivos (fase 1)

- Não reescrever motor de frete lotação
- Não migrar operação Cargo
- Não emitir CT-e real sem homolog Focus Hub
- Não clonar quotes/orders do Cargo

## Abordagens a comparar (obrigatório propor 2–3)

1. **Import-only:** RVL vira `price_tables` modality=`fracionado` via parser estendido; cálculo atual.
2. **Hybrid:** NTC oficial + overlay RVL (overrides / markup rules em `pricing_rules_config`).
3. **Schema estendido:** novas colunas/tabelas se RVL não couber em `weight_rate_*`.

Recomendar uma com trade-offs (custo, tempo, risco de divergência NTC×RVL).

## Formato da entrega

1. Resumo executivo (≤10 linhas)
2. Inventário da planilha RVL (abas, colunas, unidades)
3. Mapa RVL → schema Hub (tabela campo a campo)
4. Gaps de regra de negócio (lista priorizada P0/P1/P2)
5. Desenho de fluxo fracionado (mermaid OK)
6. Decisão de abordagem + próximos passos (plan file)
7. Salvar spec em: `docs/superpowers/specs/2026-08-01-tms-fracionado-rvl-design.md`

## Constraints técnicas Vectra HUB

- Stack: Vite + React 18 + TS + Supabase + TanStack Query
- Edge via `invokeEdgeFunction`; frete duplicado local + edge (intencional)
- RLS on; service role só em Edge
- Centavos inteiros; tipos de `@/integrations/supabase/types.generated`
- npm (nunca Bun)
- Projeto Supabase: `lrbtbrpoklgwaaclbufz` (Hub) — **não** escrever no Cargo `epgedaiukjippepujuzc` sem pedir

## Primeira ação

1. Confirmar MCP `google-drive` disponível; ler planilha RVL.
2. Comparar 1 faixa KM da RVL vs 1 row de `NTC Fracionado Dez/25` no Hub (SQL).
3. Fazer **uma** pergunta esclarecedora (RVL = import vs benchmark).
4. Só então propor abordagens e design.

---

## Checklist rápido MCP

- [ ] `google-drive` autenticado (`npx -y @piotr-agier/google-drive-mcp auth`)
- [ ] Supabase MCP / CLI linkado ao Hub
- [ ] Acesso leitura ao spreadsheet `1W8NL2PuX_OmeHKyEyylOi8h5GY9S2e4f`
