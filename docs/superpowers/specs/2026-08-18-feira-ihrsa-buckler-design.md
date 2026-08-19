# Design — Cotação Feira IHRSA (tenant embarcador, MVP Buckler)

**Data:** 2026-08-18  
**Repo:** `vectra-hub`  
**Status:** aprovado — plano em `docs/superpowers/plans/2026-08-18-feira-ihrsa-buckler.md`  
**Brainstorm:** sessão 2026-08-18 (feira SKU/kit, pedágio fracionado, isolamento schema `feira`)

---

## 1. Problema

- Vendedor no stand (IHRSA) precisa cotar por **SKU + volumes do kit**, sem caminhão, placa, eixos ou WebRouter.
- TMS Hub hoje soma pedágio via `toll_value` (rota + veículo). Na feira isso **não existe**.
- Tabela `price_table_rows.toll_percent` existe no schema, mas **não é aplicada** em `calculate-freight` e **não está preenchida** na tabela lotação ativa (Referencial Dez 2025: 0/50 linhas).
- Cliente da feira não deve poluir `public.clients` / Kanban TMS até conversão comercial.
- Time de vendas do **embarcador** (não só Vectra) precisa entrar com e-mail do domínio da empresa, cadastro na hora, sem allowlist de pessoas.

## 2. Objetivo (MVP)

1. Schema **`feira`** no mesmo projeto Supabase, isolado por `company_id` (tenant = embarcador).
2. `/feira`: vendedor Buckler (`@bucklerfit.com`) cota, salva, emite COT PDF com carimbo **IHRSA-BUCKLER**.
3. Dashboard Feira (Vectra `@vectracargo.com.br`): feed consolidado de todos os tenants, badge por embarcador/evento. **Kanban TMS intocado.**
4. Cliente: `lookupCnpj` → só `feira.clients`. Conversão Hub = passo posterior (fora do MVP).
5. Pedágio: **12% sobre frete peso** (config do tenant) até existir planilha parceiro com `toll_percent`.
6. Origem da rota: **sempre a cidade cadastrada do embarcador** (não a base Vectra).

## 3. Decisões travadas (brainstorm)

| Tema | Decisão |
|---|---|
| Banco | Mesmo projeto Hub, **schema `feira`** + `company_id`. Não projeto Supabase novo. Não `public.quotes` no MVP. |
| Cliente | Só `feira.clients`. Sem upsert em `public.clients`. |
| Pedágio | Sem `toll_value` / WebRouter / placa. MVP: `pedagio = frete_peso × (toll_fallback_percent / 100)` com **12%** no tenant. **Não** `max(toll_percent, 12)`. Quando planilha parceiro existir: `toll_percent` da faixa KM, senão fallback do tenant. |
| Tabela Hub no cálculo | Continua `calculate-freight` (hoje lotação Referencial Dez 2025). Pedágio feira é **pós-cálculo**, linha separada. |
| PDF | Reusa `generateQuotePdf` modo **simplified** + carimbo **IHRSA-BUCKLER** + linha pedágio estimado + disclaimer consolidação. |
| Dashboard | Edge `feira-quotes-feed` + **página dedicada**. Badge só nessa tela. |
| Auth vendedor | Signup Auth na hora. Domínio do **tenant embarcador** (MVP: `@bucklerfit.com`, ex. `anderson.moraes@bucklerfit.com`). Sem allowlist de e-mail, sem aprovação. |
| Auth dashboard | Time Vectra `@vectracargo.com.br` — leitura de **todos** os tenants. |
| Públicos | `/feira` = embarcador; Dashboard Feira = Vectra. |
| Origem | Sempre origem cadastrada do embarcador: Buckler → São Bernardo do Campo - SP; Boost → Fortaleza - CE; Konnen → Itajaí - SC. UI não deixa vendedor trocar origem para base Hub. |
| Multi-tenant futuro | Novo embarcador = nova `feira.companies` + domínio de e-mail + origem + catálogo. Dashboard Vectra já consolida. |
| Conversão TMS | Fora do MVP. |

## 4. Modelo de dados (schema `feira`)

### 4.1 `feira.companies`

Tenant embarcador.

- `id` UUID PK  
- `slug` TEXT UNIQUE (`buckler`, `boost`, `konnen`)  
- `name` TEXT  
- `origin_city` TEXT (`São Bernardo do Campo`)  
- `origin_uf` TEXT (`SP`)  
- `origin_label` TEXT gerado (`São Bernardo do Campo - SP`) — usado em `calculate-freight.origin`  
- `email_domains` TEXT[] (`{bucklerfit.com}`) — aceitar `.com` e `.com.br`  
- `event_flag` TEXT (`IHRSA-BUCKLER`) — carimbo PDF + badge  
- `toll_fallback_percent` NUMERIC NOT NULL DEFAULT 12  
- `price_table_id` UUID NULL — tabela Hub usada no motor (lotação hoje; parceiro depois)  
- `active` BOOLEAN  

Seed MVP: **Buckler** / SBC / `bucklerfit.com` / flag `IHRSA-BUCKLER` / 12%.

### 4.2 `feira.clients`

- `company_id` FK  
- CNPJ único por tenant  
- Campos normalizados do `lookupCnpj` (razão, fantasia, endereço, UF, município)  
- Sem FK para `public.clients`

### 4.3 `feira.quotes` + `feira.quote_lines`

Quote: destino, KM, valor carga, totais Hub, `pedagio_estimado`, `toll_method` (`fallback_12` | `table_percent`), breakdown JSON, `status`, `created_by` (auth.uid), `event_flag`.

Lines: SKU, qty, `selected_box_types[]`, peso/volume/caixas resolvidos.

Catálogo produto: reaproveitar desenho `shipper_products` / `shipper_product_boxes` **dentro do schema `feira`** (ou mover o que já foi escrito em `public` para `feira` na implementação — uma fonte só, tenant-scoped).

### 4.4 RLS

| Papel | Regra |
|---|---|
| E-mail cujo domínio ∈ `companies.email_domains` | CRUD no próprio `company_id` |
| `@vectracargo.com.br` | SELECT em todos os tenants (dashboard) |
| Demais | deny |

Signup: trigger/hook valida domínio contra `email_domains` ativos e grava `company_id` no profile (`feira.user_company` ou coluna em `profiles`). Sem papel `feira` extra no enum Hub se der para resolver só por domínio.

## 5. Cálculo de frete e pedágio

### 5.1 Fluxo

1. Origem = `companies.origin_label` (imutável na UI).  
2. Destino + KM (vendedor / tabela KM).  
3. SKUs + volumes → peso/volume (catálogo).  
4. `calculate-freight` **sem** `toll_value` (Hub hoje devolve `components.toll = 0`).  
5. `frete_peso = components.base_cost`.  
6. `pedagio = round2(frete_peso * (companies.toll_fallback_percent / 100))`.  
7. Exibição / PDF: `total_exibido = totals.total_cliente + pedagio` (Hub não inclui pedágio).  
8. Disclaimer: pedágio estimado, sujeito a ajuste na consolidação.

### 5.2 Fórmula oficial (não usar `max`)

```text
toll_pct = faixa.toll_percent   se tabela parceiro preenchida
         ?? companies.toll_fallback_percent   // 12 no MVP

pedagio = frete_peso × (toll_pct / 100)
```

`max(toll_percent, 12)` é **proibido** — mascararia % real menor que 12.

### 5.3 ICMS / NTC

Pedágio **linha separada**, fora da base de ICMS do serviço (pesquisa NTC/ANTT da sessão). Não embutir em R$/kg. Não zerar com disclaimer sem valor (comercialmente inaceitável).

### 5.4 Smoke já executado (2026-08-18)

Script: `scripts/smoke-fair-toll-capitals.ts`  
Artefatos: `docs/homolog/_smoke-fair-toll-capitals.csv` + `.json`

- Carga: M2-1009 · 321,25 kg · 1,89 m³ · NF R$ 500.000  
- Origem **naquele run:** Itajaí-SC (UI antiga) — **obsoleto para MVP Buckler**  
- Tabela: Referencial Dez 2025 lotação  
- Resultado: 27/27 OK, Hub pedágio R$ 0, fallback 12% em 100% das faixas  
- Fortaleza 3558 km: total Hub R$ 1.750,49 (bate UI R$ 1.750,32)

**Antes do go-live:** rerun smoke com origem **São Bernardo do Campo - SP** e KM SBC→capitais (não reusar matriz Itajaí).

## 6. Auth e rotas

| Rota | Quem | Domínio |
|---|---|---|
| `/feira` | vendedor stand | domínio do tenant (MVP `@bucklerfit.com`) |
| Dashboard Feira (`/feira/dashboard` ou `/comercial/feira`) | Vectra | `@vectracargo.com.br` |

- Cadastro na hora via Supabase Auth. Sem lista de e-mails, sem aprovação.  
- Convite Hub `@vectracargo.com.br` **não** substitui a regra da feira.  
- Provisionar Boost/Konnen depois: nova company + domínio + origem. Dashboard já lista todos.

## 7. PDF COT

Botão **Emitir COT** em `/feira`:

- Fonte: `feira.quotes` (não `public.quotes`)  
- `generateQuotePdf` **simplified**  
- Carimbo `event_flag` (MVP `IHRSA-BUCKLER`) header/footer  
- Breakdown: frete peso + **Pedágio estimado (12%)** + total  
- Texto: validade 48h + “pedágio estimado, sujeito a ajuste na consolidação”

## 8. Dashboard comercial (Vectra)

- Rota: **`/feira/dashboard`** — página **separada** de `/feira` (cotação). Mobile-first, Kanban TMS intocado.
- Roles Hub: `admin` | `comercial` até Auth por domínio `@vectracargo.com.br`.
- Header: logo + badge `event_flag` + seletor tenant.
- KPIs empilhados (1 col mobile / 2 col sm): total cotado, conversão, ticket médio, peso.
- Top destinos = lista ranqueada (sem mapa).
- Composição: barras horizontais Recharts (frete peso | pedágio est. | taxas) — **sem Tremor**.
- TanStack Query, `staleTime`/`refetchInterval` 30s.
- Sem schema `feira.quotes`: feed **amostra** (`isSample`). Edge `feira-quotes-feed` na implementação do plano.

## 9. Edge Functions (MVP)

| Função | Papel |
|---|---|
| `feira-save-quote` | persiste quote + lines + breakdown; valida domínio → company |
| `feira-quotes-feed` | listagem dashboard Vectra |
| `feira-generate-cot-pdf` | ou client chama gerador existente com payload feira + flag |

`calculate-freight` permanece Hub; feira **não** altera fórmula lotação. Pedágio só no pós-processo feira.

## 10. UI `/feira` (já iniciado)

- Mobile-first, kit picker por volume, stepper qty.  
- Ajustes obrigatórios neste design: origem locked no embarcador; CNPJ lookup → `feira.clients`; salvar quote; botão COT PDF; login domínio Buckler.  
- Cliente/rota colapsável permanece.

## 11. Fora de escopo (MVP)

- Conversão `feira.quotes` → `public.quotes` / OS / CT-e  
- WebRouter / VPO / eixos na cotação feira  
- Import planilha `toll_percent` parceiro (fase 2)  
- CRUD admin completo de catálogo (seed Buckler JSON basta)  
- PWA / role nova `feira` se domínio resolver  
- Tabela `fracionado_parceiro` ativa (não existe hoje no Hub)

## 12. Riscos

| Risco | Mitigação |
|---|---|
| 12% distante do pedágio real de praça | Disclaimer + fase 2 `toll_percent`; smoke SBC antes da feira |
| Gross-up Hub + pedágio somado duas vezes depois | Só somar pedágio enquanto `components.toll === 0` |
| Signup aberto em qualquer `@*.com` | Validar contra `companies.email_domains` **exatos** |
| Origem errada (Itajaí) | Campo locked; testes com SBC |

## 13. Critérios de sucesso

- Vendedor `@bucklerfit.com` cota M2-1009 SBC→Fortaleza, vê pedágio 12% sobre frete peso, emite PDF com **IHRSA-BUCKLER**.  
- CNPJ novo **não** aparece em `public.clients`.  
- Vectra vê o card no Dashboard Feira com badge. Kanban TMS sem a linha.  
- Smoke 27 capitais **origem SBC** documentado em `docs/homolog/`.
