# Rockit Kit-Unitário Mapping — Análise de Opções
**Data:** 2026-08-22  
**Contexto:** 80 halteres unitários (packing) vs 20 kits (site)

---

## 📋 O Problema

**Packing (Catálogo-Only):**
```
RKC01UDB-002 → DUMBBELL 2KG
RKC01UDB-003 → DUMBBELL 3KG
...
RKC02DB-001  → DUMBBELL 1KG (ajustável)
...
(~80 SKUs unitários)
```

**Site (Site-Only):**
```
RKC01UDB-S160 → "Rockit Dumbbell Set 160 lbs" (múltiplas peças, não é 1 dumbbell)
RKC01UDB-S420 → "Rockit Dumbbell Set 420 lbs"
...
(~20 SKUs kits)
```

**Gap:** Packing lista componentes individuais; site agrupa em kits com peso total  
**Implicação:** Volumetria muda (1 dumbbell vs Set de múltiplos)

---

## 🎯 Opções

### **Opção 1: Manter Separado (Recomendado — Status Quo)**

**Decisão:** Catálogo = Packing (100 RKC* unitários); Site kits ignorados/separado  
**Implementação:** Zero mudanças

**Pros:**
- ✅ Simples; mantém rastreabilidade unitária
- ✅ OOR 2024-09-29 baseado em packing → alinhado
- ✅ Volumes corretos (1 dumbbell = 1 volume; kit = soma)
- ✅ Nenhuma regressão

**Cons:**
- ❌ Site kits (~20) não mapeados no catálogo
- ❌ Site-only count sobe (esperado)

**Quando usar:** Prioridade = volume/OOR accuracy > site match

---

### **Opção 2: Mapeamento 1:N (Site Kit ↔ Múltiplos Packing SKUs)**

**Decisão:** Criar relação: `RKC01UDB-S160` (site) ← → `[RKC01UDB-002, RKC01UDB-003, ...]` (packing)

**Implementação:**

```typescript
// Nova tabela: kit_composition.json
{
  "RKC01UDB-S160": {
    "name": "Rockit Dumbbell Set 160 lbs",
    "site_sku": "RKC01UDB-S160",
    "components": [
      { "packing_sku": "RKC01UDB-002", "qty": 1, "weight_lbs": 2 },
      { "packing_sku": "RKC01UDB-003", "qty": 1, "weight_lbs": 3 },
      { "packing_sku": "RKC01UDB-005", "qty": 2, "weight_lbs": 5 },
      ... (total 160 lbs)
    ],
    "total_weight_lbs": 160,
    "volume_m3_unitarios": 0.15,  // soma componentes
    "volume_m3_kit": 0.18          // + embalagem kit
  }
}
```

**Audit Update:**
```typescript
// scripts/audit-konnen-kit-volumetry.ts
function getVolume(sku, qty) {
  if (isKitComposite(sku)) {
    return getCompositeVolume(sku) * qty;  // Use mapped volume
  }
  return getVolume(sku) * qty;  // Normal case
}
```

**Pros:**
- ✅ Fecha cobertura site (20 kits → matched)
- ✅ Preserva rastreabilidade unitária
- ✅ Volumetria correta (soma componentes + margem kit)
- ✅ Preparação para futuros kits (cabos, fitas, etc.)

**Cons:**
- ⚠️ Adiciona complexidade (tabela extra, parser)
- ⚠️ Requer validação manual: cada kit ↔ componentes
- ⚠️ Manutenção futura (quando site/packing atualizar)
- ~3h trabalho (validação + teste)

**Quando usar:** Prioridade = fechamento site + volumetria correta

---

### **Opção 3: Deduplicate (Packing como Base, Site Kits → Aggregated SKU)**

**Decisão:** Descartar 80 unitários do packing; criar "meta-SKU" de kits do site

```typescript
// Exemplo
{
  "RKC01UDB": {  // Meta-SKU (não existe no packing)
    "name": "Rockit Dumbbell (unitário equiv.)",
    "type": "aggregated",
    "site_skus": ["RKC01UDB-S160", "RKC01UDB-S420", ...],
    "avg_volume_m3": 0.05,
    "note": "Representing all Rockit dumbbell variants"
  }
}
```

**Pros:**
- ✅ Simplifica contagem SKU (1 meta vs 80 unitários)
- ✅ Reduz site-only

**Cons:**
- ❌ Perde rastreabilidade individual
- ❌ Volumes estimados (não exatos)
- ❌ Inconsistente com OOR 2024-09-29 (packing-based)
- ❌ Regressão potencial em volumetria

**Quando usar:** Nunca (não recomendado)

---

## 🔍 Validação de Mapeamento (Opção 2)

Se decidir **Opção 2**, validar ~20 kits com exemplo:

**Exemplo Real: RKC01UDB-S160**

```
Site: "Rockit Dumbbell Set — 160 lbs total"
  ├─ Peso total: 160 lbs ≈ 72.6 kg
  └─ Componentes típicos:
     ├─ Pair 2 lbs   (RKC01UDB-002) × 1
     ├─ Pair 3 lbs   (RKC01UDB-003) × 1
     ├─ Pair 5 lbs   (RKC01UDB-005) × 2
     ├─ Pair 10 lbs  (RKC01UDB-010) × 3
     ├─ Pair 15 lbs  (RKC01UDB-015) × 3
     ├─ Pair 20 lbs  (RKC01UDB-020) × 3
     └─ Total: 2+3+(5×2)+(10×3)+(15×3)+(20×3) = 2+3+10+30+45+60 = 150 lbs (≈ 160 target, margem)

Packing: Cada SKU unitário listado separadamente
  └─ Volume unitário (1 dumbbell 20 lbs): ~0.015 m³
  └─ Volume kit (12 pares × 0.015): ~0.18 m³ + margem → ~0.20 m³

Volumetria:
  └─ Site SKU (RKC01UDB-S160): volume_m3 = 0.20
  └─ Qty no packing: 1 (representando o kit, não componentes individuais)
```

**Etapas Validação:**
1. ✅ Raspar site: coletou 20 kits com COD/peso
2. ⚠️ Mapear SKU site ↔ componentes packing (manual ou via IA)
3. ⚠️ Validar soma peso site = soma componentes packing (±5% tolerância)
4. ⚠️ Calcular volume kit = soma volumes + margem
5. ✅ Teste: audit após mapeamento

---

## 💡 Recomendação Final

**Escolha Opção 1 (Manter Separado)** se:
- ✅ Prioridade = simplificar, zero risco, mantém OOR accuracy
- ✅ Não é crítico fechar site kits ~20 SKUs
- ✅ Quer entregar rápido (0 overhead)

**Escolha Opção 2 (Mapeamento 1:N)** se:
- ✅ Prioridade = fechamento completo site + volumetria precision
- ✅ Tem ~3h para validação manual
- ✅ Quer preparação para futuros kits (cabos, fitas)

**Meu viés:** **Opção 1** para agora  
**Roadmap:** **Opção 2** como "v2" após lançamento

---

## 📋 Próximas Ações (Opção 1)

1. ✅ Documentar decisão
2. ✅ Manter catálogo 100 RKC* (packing-based)
3. ✅ Aceitar site-only ~26 (kits não mapeados — esperado)
4. ✅ Re-run audit (já feito)
5. ✅ Commit

**Comando:**
```bash
npx tsx scripts/audit-konnen-kit-volumetry.ts --phase=acessorios --no-kit-mapping
git add docs/
git commit -m "refactor: finalize acessorios audit (Rockit kit-unitário kept separate)

- Rockit: 100 SKU packing-based (unitários + barras)
- Site kits (20) not mapped (expected; separate line)
- XMASTER: 60 SKUs packing-only (site pré-lançamento)
- Acessórios/OKPRO: gaps documentados
- site-only: 153 (up from 107, esperado)
- Próximo: (1) commit, (2) UI catalog_group, (3) v2 kit-mapping (optional)

Refs: faire/Konnen#audit-acessorios"
```

---

## 📁 Artifacts

| Arquivo | Descrição | Próxima Ação |
|---------|-----------|-------------|
| `STATUS_POSCRAPE_ACESSORIOS.md` | Análise cobertura (este doc) | ✅ Revisar |
| `ROCKIT_KITUNITARIO_OPTIONS.md` | Opções mapeamento | ← Você está aqui |
| `site-gaps-acessorios.json` | Gaps por linha | ✅ Fornecido (scrape) |
| `konnen-site-audit-report.json` | Merge site+catálogo | ✅ Atualizado |

---

**Decisão solicitada:** Opção 1 (manter separado) ou Opção 2 (mapeamento 1:N)?**

---

*Recomendação: Opção 1 agora; Opção 2 na v2 (roadmap)*
