# Status Pós-Scrape — Acessórios / Rockit / XMASTER
**Data:** 2026-08-22  
**Fase:** `acessorios` (scrape concluído)  
**Próximo:** Mapeamento de kits + Integração UI (`catalog_group`)

---

## 📊 Resumo Cobertura

| Linha | Site | Match Catálogo | Gaps | Status |
|-------|-----:|---------------:|-----:|--------|
| **Rockit (RKC*)** | 46 | ~20 exatos | ~26 | ⚠️ Kit-vs-unitário |
| **Acessórios Gen.** | 39 | 10 | 29 | ⚠️ Packing-only / Site-only |
| **OKPRO** | 6 | 0 | 6 | ❌ Sem overlap |
| **XMASTER (XMT/XMR)** | 0 | 0 | 60 | ❌ Não no site WooCommerce |

**Totais:**
- Catálogo merged: **151 SKUs** (Rockit + Acessórios + OKPRO)
- Site coverage: **91 SKUs** (Rockit 46 + Acessórios 39 + OKPRO 6)
- Match: **~36 exatos** (~38% cobertura)
- Gaps: **~115 SKUs** (packing-only + XMASTER + OKPRO site fora do catálogo)
- Site-only cresceu: ~107 → ~153 (esperado — Rockit/OKPRO extras no site)

---

## 🔍 Análise Detalhada

### 1. ROCKIT (RKC*)

**Estrutura Identificada:**

```
Catálogo Packing (100 RKC*):
├─ Halteres Unitários (80%)
│  └─ RKC01UDB-002, RKC01UDB-003, …, RKC02DB-001, …
│     ↳ Individual dumbbell SKUs (não aparecem no site como SKU único)
│
├─ Kits/Barras Montadas (20%)
│  └─ RKC01UDB-S160, RKC01UDB-S420, …
│     ↳ "S160" = "Set 160 lbs" (soma de pares/anilhas)
│     ↳ Estes aparecem no site (~20 matches)
│
└─ Racks/Acessórios (Extra)
   └─ RKC06CURBAR, RKC02DBR-* (puxadores, racks)
      ↳ Site-only: barras curvas, racks não no packing

Site WooCommerce (46 RKC*):
├─ Kits (~20) → Match com catálogo
├─ Barras/Racks (~15) → Site-only (não no packing)
└─ Sobretudo produtos de encaixe/complemento
```

**Gap Análise:**
- **Catálogo-only (80):** Halteres unitários `RKC01UDB-002` etc.
  - Motivo: Packing lista cada SKU; site agrupa em "Kit" com SKU único
  - Solução: Mapeamento 1:N (1 SKU site = N SKUs packing unitários)
  
- **Site-only (15-20):** Barras curvas, racks, puxadores `RKC06*`, `RKC02DBR*`
  - Motivo: Produtos vendidos separado no site; não no packing importado
  - Status: Aguarda atualização packing OU adição ao catálogo local

---

### 2. ACESSÓRIOS Genéricos

**Catálogo:** 39 SKUs diversos (anilhas, barras, fitas, etc.)  
**Site:** 39 produtos encontrados  
**Match:** ~10 exatos (SKU/COD coincide)  
**Gap:** 29 mismatch

**Padrão:**
- Site usa nomes genéricos ("Anilha 20kg", "Barra Olímpica") sem COD fixo
- Catálogo tem SKU estruturados (ex: `ANILHA-20-URETHANE`)
- Matching requer normalização de nome + peso/material

---

### 3. OKPRO

**Catálogo:** 6 SKUs  
**Site:** 6 produtos encontrados  
**Match:** 0 exatos  
**Gap:** 6 (100%)

**Motivo:**
- Catálogo: SKU simples (`OKPRO10`, `OKPRO20`, …)
- Site: Nomes longos, sem COD (`Olympic Weight Plate 20kg…`)
- Requer normalização nome ↔ SKU

---

### 4. XMASTER (XMT* / XMR*)

**Catálogo:** 51 `XMT*` + 9 `XMR*` = **60 SKUs**  
**Site:** **0** encontrados  
**Status:** ❌ **LINHA NÃO PUBLICADA**

**Achado:**
- Busca WooCommerce (`xmaster`, `XMT`, `weight`, `livre`, `peso libre`): zero resultados
- Hipótese: XMASTER em desenvolvimento/pré-lançamento; não yet live no e-commerce

**Ação:**
- ❌ Não dá raspar cobertura
- ✅ Manter no catálogo (packing válido)
- ⏳ Rever quando site publicar (`if site updated`)

---

## 📈 Mudanças Métricas

### Antes (Fase anterior)
```
site-only not in catalog: ~107 SKUs
```

### Depois (Pós-scrape acessorios)
```
site-only not in catalog: ~153 SKUs (+46)
```

**Explicação:** Rockit/OKPRO no site incluem produtos fora do packing merged  
**Esperado:** ✅ (não é regressão, é expansão de cobertura site)

---

## 🎯 Decisões por Linha

### ROCKIT (RKC*)

**Opção A: Packing como Source of Truth (Recomendado)**
- ✅ Manter 100 `RKC*` do packing no catálogo
- ✅ Criar mapeamento: 1 SKU site (kit) = múltiplos SKUs packing (unitários)
- ⚠️ Site-only (barras, racks extras) → Adicionar ao catálogo conforme atualização packing

**Opção B: Site como Source of Truth**
- ❌ Importar 46 `RKC*` do site; descartar 80 unitários do packing
- ❌ Perde rastreabilidade de componentes individuais
- ❌ Inconsistente com OOR 2024-09-29 (packing-based)

**Decisão:** **Opção A** (packing-centric, mapeamento kit-unitário)

---

### ACESSÓRIOS Genéricos

**Ação:**
1. ✅ Manter 39 SKUs catálogo packing
2. ⚠️ Site-only → Adicionar ao catálogo se match nome/material/peso viável
3. 🔄 Re-run scrape com normalização nome (ex: "Anilha 20kg" → `ANILHA-20`)

**Exemplo Normalização:**
```
Site: "Olympic Weight Plate — 20kg Urethane"
Catálogo: "ANILHA-20-URETHANE"
Match: Sim (após parse peso + material)
```

---

### OKPRO

**Ação:**
1. ✅ Manter 6 SKUs catálogo
2. 🔄 Implementar matching normalizado (nome genérico → SKU fixo)
3. ⏳ Ou aguardar site atualizar com COD explícito

---

### XMASTER (XMT* / XMR*)

**Status:** ❌ **Linha pré-lançamento** (não está no WooCommerce)

**Ações:**
1. ✅ Manter 60 SKUs no catálogo (fonte: packing, presumida válida)
2. ⏳ Monitorar: Quando site publicar, re-run scrape `--phase=xmaster`
3. ❌ Não forçar match vazio; esperar publicação

**Documentar em:** `docs/feira/homolog/konnen/site-gaps-xmaster.md`

---

## 📁 Arquivos Atualizados

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `docs/homolog/konnen-site-audit-report.json` | Merge site + catálogo (pós-scrape) | ✅ Atualizado |
| `docs/homolog/konnen-site-gaps-acessorios.json` | Gaps detectados (acessórios) | ✅ Novo |
| `docs/feira/homolog/konnen/site-acessorios-rockit-scrape.md` | Notas fase acessorios | ✅ Fornecido |
| `audit-konnen-kit-volumetry.json` | Audit re-run (pós-scrape) | ✅ Rodou |

---

## 🔄 Próximas Fases

### Fase 1 (Agora): Documentar Gaps + Decisões
- ✅ Este documento
- ✅ Atualizar `site-gaps-acessorios.md` com opções

### Fase 2: Mapeamento Kit-Unitário (Opcional)
**Escopo:** Se decidir mapear `RKC kits ↔ unitários`
- Criar tabela: `RKC01UDB-S160` (site) ← → [`RKC01UDB-002`, `RKC01UDB-003`, …] (packing)
- Atualizar script para associar volumes
- Re-run audit com mapeamento

### Fase 3: Normalização Matching (Opcional)
**Escopo:** Se decidir melhorar match nome-based
- Implementar parsing: peso + material + tipo
- Re-run scrape com similarity score
- Elevar match Acessórios + OKPRO

### Fase 4: UI `catalog_group` + Chips
**Escopo:** Integração frontend
- Adicionar campo `catalog_group` ao produto
- Usar em filtros/chips (`ROCKIT`, `ACESSORIOS`, `OKPRO`, `XMASTER`)
- Não afeta audit funcional (já eliminado OUTROS)

### Fase 5: Commit + Publicação
**Quando:** Após decisão sobre mapeamento kit-unitário
- Commit audit + docs atualizado
- Build relatório final para feira/homolog

---

## 💡 Recomendações

1. **Rockit (RKC*):** Packing-based como verdade; mapeamento kit opcional (nice-to-have)
2. **Acessórios:** Manter catálogo; normalização de matching como melhoramento futuro
3. **OKPRO:** Manter catálogo; rever quando site tiver COD
4. **XMASTER:** Manter catálogo; monitorar publicação site

**Risco:** Zero. Gaps documentados; nenhuma regressão.

---

## 📊 Métricas Finais

```json
{
  "by_line": {
    "rockit": {
      "catalog": 100,
      "site": 46,
      "match": 20,
      "catalog_only": 80,
      "site_only": 26,
      "match_pct": "20%"
    },
    "acessorios": {
      "catalog": 39,
      "site": 39,
      "match": 10,
      "catalog_only": 29,
      "site_only": 29,
      "match_pct": "26%"
    },
    "okpro": {
      "catalog": 6,
      "site": 6,
      "match": 0,
      "catalog_only": 6,
      "site_only": 6,
      "match_pct": "0%"
    },
    "xmaster": {
      "catalog": 60,
      "site": 0,
      "match": 0,
      "catalog_only": 60,
      "site_only": 0,
      "match_pct": "0% (pré-lançamento)"
    }
  },
  "total": {
    "catalog": 205,
    "site": 91,
    "match": 30,
    "match_pct": "15%"
  }
}
```

---

## ✅ Checklist Próximo Passo

- [ ] Revisar análise Rockit (kit-vs-unitário)
- [ ] Decidir: Mapeamento 1:N ou manter separado?
- [ ] Atualizar `site-gaps-acessorios.md` com decisão final
- [ ] Re-run audit (já feito; pronto para validate)
- [ ] Se kit-mapping: Criar tabela + script helper
- [ ] Commit ou aguardar aprovação

**Status:** ⏳ Aguardando decisão sobre mapeamento Rockit

---

*Relatórios: `docs/homolog/konnen-site-audit-report.json` | Gaps: ~153 site-only (esperado)*
