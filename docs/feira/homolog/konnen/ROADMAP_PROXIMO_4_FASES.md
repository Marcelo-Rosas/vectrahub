# Roadmap Executivo — Próximas Fases Konnen Audit
**Data:** 2026-08-22  
**Status:** Audit funcional (OUTROS eliminado) + Scrape acessórios **concluído**

---

## 🎯 Estado Atual

| Componente | Status | Status |
|---|---|---|
| **Functional Group Classifier** | ✅ Implementado | OUTROS = 0 |
| **Rockit/Acessórios Scrape** | ✅ Concluído | 91 SKUs encontrados |
| **Kit-Unitário Mapping** | ⏳ Pendente decisão | Opção 1 ou 2? |
| **XMASTER Site Coverage** | ❌ Zero (pré-lançamento) | Monitorar publicação |
| **UI `catalog_group` + Chips** | 🔴 Não iniciado | Próxima fase |
| **Commit + Build Relatório** | 🔴 Não iniciado | Após decisão mapping |

---

## 📅 Próximas 4 Fases

### **Fase 1: Decisão Kit-Unitário (AGORA — 15 min)**

**Scope:** Escolher Opção 1 ou 2  
**Entrada:** `ROCKIT_KITUNITARIO_OPTIONS.md`  
**Saída:** Decisão documentada + "GO" para fase 2

**Opções:**
- **Opção 1 (Recomendado):** Manter separado; 0 overhead; site-only +26 (esperado)
- **Opção 2:** Mapeamento 1:N; ~3h validação; fecha cobertura site

**Próximo:** Fase 2 (qualquer que seja decisão)

---

### **Fase 2: Consolidar & Commit Audit (30 min)**

**Scope:**
1. ✅ Atualizar docs finais com decisão mapping
2. ✅ Confirmar `audit-konnen-kit-volumetry.json` zero OUTROS
3. ✅ Validar testes Vitest 100% passando
4. ✅ Build relatório markdown final
5. ✅ Git commit

**Entradas:**
- `konnen-functional-group.ts` (já criado)
- `konnen-functional-group.test.ts` (já criado)
- `STATUS_POSCRAPE_ACESSORIOS.md` + `ROCKIT_KITUNITARIO_OPTIONS.md`

**Saída:**
```bash
git commit -m "refactor: finalize konnen audit — OUTROS eliminated + acessorios scraped"
# Branch: main
# Tags: v2026-08-22-audit-complete
```

**Checklist:**
- [ ] Testes passam 100%
- [ ] OUTROS = 0 em JSON
- [ ] RKC* = ACESSORIOS
- [ ] Relatório MD gerado
- [ ] Nenhuma mudança UI (chips intactos)
- [ ] Commit + push

---

### **Fase 3: UI Integration — `catalog_group` + Chips (2-3h)**

**Scope:** Integrar classificação funcional na UI `/feira`

**O que NÃO muda:**
- ✅ Chips atuais (IMPULSE, XMASTER, ROCKIT) continuam igual
- ✅ Página produto, carrinho, etc.

**O que MUDA:**
- Adicionar campo `catalog_group` a produto
- Usar em filtros/buscas (backend)
- Opcional: exibir badge secundário (ex: "Pin Loaded | Rockit")

**Entradas:**
- Schema produto: adicionar `functionalGroup?: string`
- Seed/migration: popular com resultado audit

**Implementação:**
```typescript
// types/Product.ts
interface Product {
  id: string;
  name: string;
  sku: string;
  // ... outros campos
  functionalGroup?: 'PIN LOADED' | 'PLATE LOADED' | 'CABLE CROSS' | 'BENCHES & RACKS' | 'ACESSORIOS' | 'CARDIO';
  chip?: 'IMPULSE' | 'XMASTER' | 'ROCKIT';  // Mantém intacto
}

// Pode ser usado em:
// - Filtro: `?functionalGroup=PLATE_LOADED`
// - Agrupamento: "Máquinas com Anilhas", "Bancos e Estruturas", etc.
// - Analytics: track "cliques em PIN LOADED"
```

**Saída:**
- ✅ Produtos com `functionalGroup` preenchido
- ✅ Testes de integração passando
- ✅ Filtro/busca funcional

**Timeline:** 2-3h desenvolvimento; 1h testes

---

### **Fase 4: Deploy + Build Final (30 min)**

**Scope:**
1. Merge para main (se não já)
2. Build producción
3. Deploy staging/prod
4. QA final

**Artifacts Finais:**
```
docs/feira/homolog/konnen/
├─ kit-volumetry-stack-audit.md          (relatório final)
├─ kit-volumetry-stack-audit.json        (dados estruturados)
├─ site-gaps-acessorios.json             (gaps documentados)
├─ site-acessorios-rockit-scrape.md      (notas scrape)
└─ 2026-08-22-konnen-audit-complete.md   (sumário executivo)

src/lib/
├─ konnen-functional-group.ts            (classifier)
└─ konnen-functional-group.test.ts       (100+ tests)
```

---

## 📊 Entregáveis Finais (Todas as Fases)

### **Documentação**
- ✅ `IMPLEMENTAÇÃO_OUTROS_ELIMINATION.md` — Heurísticas + passo-a-passo
- ✅ `STATUS_POSCRAPE_ACESSORIOS.md` — Análise cobertura scrape
- ✅ `ROCKIT_KITUNITARIO_OPTIONS.md` — Opções mapeamento
- ✅ Audit JSON com OUTROS = 0
- ✅ Gaps JSON (acessórios, rockit, xmaster)

### **Código**
- ✅ `konnen-functional-group.ts` — Classifier (5 níveis heurísticas)
- ✅ `konnen-functional-group.test.ts` — 100+ testes
- ✅ UI: `catalog_group` field + filtros (Fase 3)

### **Validação**
- ✅ Testes Vitest 100% green
- ✅ OUTROS = 0 em audit JSON
- ✅ RKC* → ACESSORIOS (verified)
- ✅ PIN LOADED intacto (FE97, IF93, IT95)
- ✅ Site cobertura documentada (91 SKUs matched)

---

## ⏱️ Timeline Total

| Fase | Tarefa | Tempo | Acumulado |
|------|--------|-------|-----------|
| 1 | Decisão kit-unitário | 15 min | 15 min |
| 2 | Commit audit | 30 min | 45 min |
| 3 | UI integration | 2-3h | 2h 45 min |
| 4 | Deploy final | 30 min | 3h 15 min |

**Total:** ~3.25h (maioria = UI; audit core = 45 min)

---

## 🔄 Dependências Críticas

- **Fase 2 → 3:** Kit-unitário decision (qualquer opção)
- **Fase 3 → 4:** Schema migration + seed (dados estruturados)
- **Bloqueadores:** Nenhum; pode paralelizar 3 + 4

---

## 📋 Decisões Pendentes

### **1. Kit-Unitário Mapping**
- **Opção 1:** Manter separado (recomendado; 0 overhead)
- **Opção 2:** Mapeamento 1:N (3h validação; fecha site)
- **Prazo:** Agora (15 min)

### **2. XMASTER Linha**
- **Status:** Não no site (pré-lançamento)
- **Ação:** Manter catálogo 60 SKUs; monitorar site
- **Prazo:** N/A (passivo; rever se publicado)

### **3. UI Rollout**
- **Timing:** Após Fase 2 (commit)
- **Scope:** Full rollout ou beta?
- **Prazo:** Fase 3

---

## ✅ Critério de Sucesso (Todas Fases)

- [ ] Fase 1: Decisão documentada
- [ ] Fase 2: Audit committed; OUTROS = 0; 100% testes green
- [ ] Fase 3: UI com `catalog_group`; filtros funcionais
- [ ] Fase 4: Deploy concluído; QA passou

---

## 📞 Próximo Passo

**Responda:**
1. **Kit-unitário:** Opção 1 ou 2?
2. **Timing Fase 3:** Paralela com Fase 2 ou após commit?
3. **UI Rollout:** Full ou beta?

**Ao receber respostas, procedo com:**
- Fase 2: 30 min (commit)
- Fase 3: 2-3h (UI)
- Fase 4: 30 min (deploy)

**Estimado Conclusão:** Hoje (se decisões rápidas) ou amanhã (se Fase 3 full)

---

*Roadmap pronto. Aguardando GO (Fase 1 decision).*
