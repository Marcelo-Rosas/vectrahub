# Konnen audit — decisões locked 2026-08-22

| # | Tema | Decisão |
|---|---|---|
| 1 | Kit-Unitário Rockit | **Opção 1** — packing = source of truth; kits site checklist only |
| 2 | Fase 3 timing | **Sequencial** — commit audit → UI beta depois |
| 3 | UI rollout | **Beta** — fila “Tipo de equipamento” (PIN/PLATE/…); chips IMPULSE/XMASTER/ROCKIT intactos |

Implementado (Fase 3 beta):
- `functionalGroup` no entry (client enrich Konnen)
- Filtro secundário + badge dashed na lista SKU
- Sem migration DB / sem overwrite `catalog_group` comercial

Próximo: Fase 4 deploy (após QA).
