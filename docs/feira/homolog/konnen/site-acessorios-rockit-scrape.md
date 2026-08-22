# Site scrape — Acessórios / Rockit / XMASTER

Atualizado: 2026-08-22 (fase `acessorios`)

## O que foi raspado

| Linha | URL | Site | Match catálogo | Gaps |
|---|---|---:|---:|---:|
| rockit | `/categoria-produto/rockit/` | 44 | 25 | 19 |
| acessorios | `/categoria-produto/acessorios/` | 39 | 10 | 29 |
| acessorios-okpro | `/categoria-produto/acessorios/okpro/` | 6 | 0 | 6 |

Relatório merge: `docs/homolog/konnen-site-audit-report.json`  
Gaps: `docs/homolog/konnen-site-gaps-acessorios.json`

## ROCKIT (RKC*)

- **46** SKUs `RKC*` no site (após dedupe).
- Catálogo packing: **100** `RKC*`.
- Interseção exata: **~20** (barras/anilhas urethane com COD alinhado).
- Catálogo-only: ~80 — em geral **halteres unitários** `RKC01UDB-002`… no packing; no site só **kits** (`RKC01UDB-S160`, `S420`, …) → SKU diferente, não é gap de crawl.
- Site-only: barras/racks/puxadores (`RKC06CURBAR`, `RKC02DBR-*`, …) ausentes do merged packing.

## XMASTER (XMT* / XMR*)

- Catálogo: **51** `XMT*` + **9** `XMR*`.
- Site WooCommerce: **0** produtos (busca `xmaster` / `XMT` / `peso livre` sem listagem).
- **Não dá para fechar cobertura XMASTER via scrape** — packing-only até o site publicar a linha.

## Re-run

```bash
npx tsx scripts/audit-konnen-site-catalog.ts --phase=acessorios
npx tsx scripts/audit-konnen-kit-volumetry.ts
```

site-only not in catalog sobe (~107 → ~153) porque Rockit/OKPRO no site inclui SKUs (e páginas sem COD) fora do packing — esperado.
