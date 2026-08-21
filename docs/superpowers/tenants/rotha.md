# Tenant Feira — Rotha Fitness

Fonte: catálogo canônico PDF **CATALOGO ROTHA** Scribd `830294749` (`C:\Users\marce\Downloads\830294749-CATALOGO-ROTHA.pdf`) + medidas C×L×A catálogo 2025–2026 (suportes numerados) + caixa similar Konnen. Site [rothafitness.com](https://rothafitness.com/).

**SKU = código comercial do PDF.** `R####` da NF é alias (`nf_skus`), **não** SKU.

| Campo | Valor |
|---|---|
| slug | `rotha` |
| name | Rotha Fitness |
| CNPJ | 43.466.166/0001-00 |
| site | [rothafitness.com](https://rothafitness.com/) |
| origem | Taboão da Serra - SP (`06765350`) |
| email_domains | `rothafitness.com` |
| brand API | Edge `feira-resolve-brand` + cache `feira.company_brands` |
| event_flag | `ROTHA` |

## Catálogo canônico

Código em `src/lib/rotha-catalog.ts` → `ROTHA_CANONICAL_CATALOG`. Build: `npx tsx scripts/build-rotha-feira-catalog.ts`. Import: `npx tsx scripts/import-rotha-feira-catalog.ts` (desativa SKU antigo, incl. `R####`).

| Prefixo | Produto | Peso | Medida |
|---|---|---|---|
| `DBSIX{kg}` | Dumbbell Six 12–120 kg | nominal 1 pç | caixa Konnen UDB (12–36); >36 caixa vizinha |
| `ANVAN{kg}` | Anilha Black 1 / 2,5 / 5 / 10 / 15 / 20 / 30 | nominal | caixa Konnen UWP |
| `BMSIX{kg}` | Barra montada Six 10–65 passo 5 | nominal | caixa Konnen BBS (10–30); >30 vizinha |
| `HALSEX{n}` / `HALTSEX{n}` | Halter sextavado 1–10 kg | nominal | 220×90×90 mm |
| `KETTEX{kg}` | Kettlebell 4–32 kg | nominal | kettle Konnen escalado |
| `OLBACR-*` / `STBACROMR-*` | Barras por comprimento | estimado comprimento | seção 90 mm |
| `PUX-*` | Puxadores | 4 kg / corda 2,5 kg | 400×250×120 (corda 600×150×150) |
| `SUPDUMBLACK-{pares}` | Rack Black 2 níveis | 13 pares = 95 kg Konnen; resto proporção | C×L×A 2025 (L 0,75 A 0,72) |
| `SUPDUMBLACK-3N-{pares}` | Rack Black 3 níveis | estimado | C×L×A 2025 (L 0,75 A 0,84) |
| `SUPTORHAL-PRE-10` | Curvado 10 pares | 70 kg | 1350×530×530 |
| `SUPBARRA-BLACK` | Barras montadas | 50,3 kg | 1525×845×170 |
| `LAND001` `CANMODBARRA002-*` `SUPKET-*` | demais suportes | estimado | `homolog_pending` |

## Alias NF (não SKU)

| Comercial | NF |
|---|---|
| `ANVAN2.5` / `5` / `10` / `20` | `R6002` / `R6005` / `R6010` / `R6020` |
| `PUX-W` `PUX-RETO` `PUX-V` `PUX-CORDA` `PUX-ALCA` | `R1610` `R1604` `R1609` `R1601` `R1607` |
| `SUPDUMBLACK-13` | `R3074.1` |
| `SUPTORHAL-PRE-10` | `R1531.1` |
| `SUPBARRA-BLACK` | `R1511.1` |

Kits NF `R4070` `R1282` `R3501` `R3506` `R1751` **não** viram SKU (catálogo vende peça / sem código no kit anatômico).

## Rotas UI

| Rota | UI |
|---|---|
| `/feira` | `FairQuoteCalculator` + catálogo DB |
| `/feira/simples` | Frete manual |

## Homolog

- PDF 36p tem código; PDF 2025 tem C×L×A dos racks numerados, **sem** `CÓD. DO PRODUTO`
- Validar peso estimado (`homolog_pending: true`) com tabela de preço Rotha
