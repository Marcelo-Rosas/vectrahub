# Tenant Feira — PlayFit Pisos

Fonte: `feira.products` + `feira.product_boxes` + `src/lib/playfit-stack.ts`.

| Campo | Valor |
|-------|-------|
| slug | `playfit` |
| site | [playfitpisos.com.br](https://playfitpisos.com.br/) |
| email_domains | `playfitpisos.com.br`, alias `playfitpiso.com.br` |
| cadastro | `/auth?feira=1&tenant=playfit` — ex. `usuario@playfitpiso.com.br` ou `@playfitpisos.com.br` |

## Catálogo DB (`/feira` e `/feira/simples`)

SKUs por **linha** (espessura):

| SKU | Linha | Placa | m²/placa | kg/placa | Uso |
|-----|-------|-------|----------|----------|-----|
| `PLAYFIT-13` | 13 mm | 500×500 mm | 0,25 | 3,5 | Playground econômico |
| `PLAYFIT-16` | 16 mm | **1×1 m** | 1,0 | 14 | Playground UV (padrão) |
| `PLAYFIT-26` | 26 mm | 500×500 mm | 0,25 | 6,5 | Playground / academia |
| `PLAYFIT-40` | 40 mm | **1×1 m** | 1,0 | 40 | Playground ABNT / intertravado |

Cada SKU traz `colors` JSON (badges UI) e `typical_use`.

## Peso

**Não** usa kg/m² genérico no gate — `peso = placas × weight_kg_per_plate` da linha.

## Montagem pallet (PBR 1,0×1,2 m)

Fórmula (`playfit-stack.ts`):

- Empilhamento placas = `placas × espessura_mm`
- Altura total = empilhamento + **150 mm** base PBR
- m³ = `1,0 × 1,2 × altura_total_m`

**Exemplo linha 16 mm × 80 placas:**

- Empilhamento **1.280 mm**
- + base PBR **150 mm** = **1.430 mm** (1,43 m)
- Volume ≈ **1,716 m³** por pallet

Montagem por linha (`feira.product_boxes.box_type`):

| Linha | Badges montagem |
|-------|-----------------|
| 13 / 16 / 26 | 50 · 60 · 70 · 80 |
| 40 mm | **20 · 30 · 40** (teto ~2 m) |

## Rotas UI

| Rota | UI |
|------|-----|
| `/feira/simples` | `PlayFitLinePicker` + cores + montagem |
| `/feira` | Idem + stepper pallets |

## Homolog

Peso/placa e cores — validar ficha técnica PlayFit antes produção.
