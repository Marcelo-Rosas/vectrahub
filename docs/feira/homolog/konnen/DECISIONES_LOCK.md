# Konnen audit — decisões locked 2026-08-22

| # | Tema | Decisão |
|---|---|---|
| 1 | Kit-Unitário Rockit | **Opção 1** — packing = source of truth; kits site checklist only |
| 2 | Fase 3 timing | **Sequencial** — commit audit → UI beta depois |
| 3 | UI chips (atualizado 2026-08-22) | **Clone Buckler** — só PIN LOADED / PLATE LOADED / CABLE CROSS / BENCHES & RACKS / ACESSORIOS / CARDIO. **Sem** fila IMPULSE/XMASTER/ROCKIT |

Implementado:
- `functionalGroup` no entry (client enrich Konnen)
- Chips UI = grupos funcionais (rótulos Buckler); marcas comerciais fora do header Equipamentos
- Sem migration DB / sem overwrite `catalog_group` comercial

Fase 4 (2026-08-22):
- Push `feat/pricing-rules-by-methodology` → `80675d9`
- Pages `vectra-feira` deploy OK → https://app.feira.vectracargo.com.br
