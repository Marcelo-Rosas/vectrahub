# Implementação: Eliminação do Grupo OUTROS — Konnen Audit

**Status:** 🟢 Pronto para implementação  
**Data:** 2026-08-22  
**Escopo:** Atualizar heurísticas funcionais Konnen para eliminar OUTROS completamente  

---

## 📋 Resumo

Reorgnaizar a função `konnenFunctionalGroup()` para **mapear 100% dos SKUs** em um dos 6 grupos válidos:
- PIN LOADED
- PLATE LOADED
- CABLE CROSS
- BENCHES & RACKS
- ACESSORIOS
- CARDIO

**Resultado esperado:** `metrics.byFunctionalGroup.OUTROS = 0` no audit JSON

---

## 📂 Arquivos Fornecidos

| Arquivo | Descrição | Ação |
|---------|-----------|------|
| `konnen-functional-group.ts` | Implementação com novas heurísticas | Copiar/colar para `src/lib/konnen-functional-group.ts` |
| `konnen-functional-group.test.ts` | 100+ testes (Vitest) | Copiar/colar para `src/lib/konnen-functional-group.test.ts` |
| `IMPLEMENTAÇÃO_OUTROS_ELIMINATION.md` | Este documento | Referência |

---

## 🔧 Heurísticas (Ordem de Precedência)

### Nível 1: Prefixos de Máquinas (Exatos)

```typescript
FE97*    → PIN LOADED (Exoform)
IF93*    → PIN LOADED (IF série core)
IT95*    → PIN LOADED (Impulse série)
LCS*     → PIN LOADED (LCS)
AM80*    → PIN LOADED (Articulado Torq)

IFP*     → PLATE LOADED (IF Plate Load)
SL*      → PLATE LOADED (SL série)
ECP*     → PLATE LOADED (ECP série)
IFL*     → PLATE LOADED (IF Plate Herbert)
```

**Justificativa:** Prefixos identificam série/linha de produção. Não mudar.

---

### Nível 2: Prefixos de Acessórios (Exatos)

```typescript
RKC*     → ACESSORIOS (Rockit)
FEWS*    → ACESSORIOS (Free Weight Set)
IF93WS*  → ACESSORIOS (IF Weight Set)
IT95WS*  → ACESSORIOS (Impulse Weight Set)
XMT*     → ACESSORIOS (XMASTER weights/plates)
XMR*     → ACESSORIOS (XMASTER rubber plates)
OKPRO*   → ACESSORIOS (OKPRO anilhas)
```

**Justificativa:** Pesos, barras, anilhas, kits são componentes/acessórios.

---

### Nível 3: Prefixos de Cardio (Exatos)

```typescript
EC*      → CARDIO (Cardio Equipment Impulse)
PS*      → CARDIO (Spin/Commercial Bike)
HSR*     → CARDIO (Rowing)
HB*      → CARDIO (Air Bike)
V9*      → CARDIO (V9 série)
```

**Justificativa:** Equipamentos cardiovasculares específicos.

---

### Nível 4: Classificação por Nome (Híbrida — Para Prefixos Ambíguos)

Aplicado quando nenhum prefixo exato captura. **Ordem importa:**

#### 4a. CABLE CROSS

```regex
/cable|crossover|polia|pulley/i
```

**Exemplos:**
- "DUAL PULLEY CABLE CROSS" → CABLE CROSS
- "FUNCTIONAL CROSSOVER" → CABLE CROSS
- "POLIA DUPLA" → CABLE CROSS

---

#### 4b. BENCHES & RACKS

```regex
/bench|chair|seat|squat|rack|cage|power|smith|dumbbell|adjustable/i
```

**Exemplos:**
- "ADJUSTABLE BENCH" → BENCHES & RACKS
- "POWER RACK COMMERCIAL" → BENCHES & RACKS
- "SQUAT CAGE WITH SAFETY" → BENCHES & RACKS
- "SMITH MACHINE" → BENCHES & RACKS

**Prefixos híbridos beneficiados:**
- `TN*` + "BENCH" → BENCHES & RACKS
- `TB*` + "RACK" → BENCHES & RACKS
- `IF*` + "CAGE" → BENCHES & RACKS

---

#### 4c. ACESSORIOS (Attachments & Accessories)

```regex
/attachment|extension|panel|home.gym|home.equipment|kit|load|arm|bar|weight|plate|accessory|barbell/i
```

**Exemplos:**
- "LEG ATTACHMENT KIT" → ACESSORIOS
- "ARM EXTENSION KIT" → ACESSORIOS
- "DUMBBELL KIT 1-50LBS" → ACESSORIOS
- "OLYMPIC BARBELL 20KG" → ACESSORIOS

**Prefixos híbridos beneficiados:**
- `TM*` + "ATTACHMENT" → ACESSORIOS
- `IF*` + "EXTENSION" → ACESSORIOS

---

#### 4d. CARDIO (Fallback Genérico)

```regex
/cardio|stair|climb|step|tread|walk|elliptic|elliptical|bike|row|rowing|cycle|machine|trainer|climber|stepper/i
```

**Exemplos:**
- "TREADMILL COMMERCIAL" → CARDIO
- "ELLIPTICAL MACHINE" → CARDIO
- "ROWING MACHINE PRO" → CARDIO
- "STAIRCLIMBER STEPMILL" → CARDIO

---

### Nível 5: Fallback (RESIDUAL — Máximo ~10 SKUs)

Se nenhuma regra capturar:
1. **Log warning** com SKU e nome
2. **Retorna:** `ACESSORIOS` (default seguro)

```typescript
console.warn(
  `[konnen-functional-group] Unclassified SKU: ${sku} (${name})`
);
return 'ACESSORIOS';
```

**Documentar** qualquer fallback no appendix do relatório com:
- SKU
- Nome
- Motivo (nenhuma heurística capturou)

---

## 🚀 Passo a Passo para Implementação

### 1. **Backup do Arquivo Atual**

```bash
cd c:\Users\marce\vectra-hub
cp src/lib/konnen-functional-group.ts src/lib/konnen-functional-group.ts.backup
```

### 2. **Substituir Implementação**

Copie o conteúdo de `konnen-functional-group.ts` (fornecido) para:
```
src/lib/konnen-functional-group.ts
```

### 3. **Atualizar Testes**

Copie o conteúdo de `konnen-functional-group.test.ts` (fornecido) para:
```
src/lib/konnen-functional-group.test.ts
```

### 4. **Executar Testes**

```bash
npm run test -- konnen-functional-group.test.ts
# ou
npx vitest konnen-functional-group.test.ts
```

**Esperado:** ✓ Todos os testes passam (100+ casos)

### 5. **Regenerar Audit**

```bash
npx tsx scripts/audit-konnen-kit-volumetry.ts
```

**Esperado:** Arquivo JSON gerado em `docs/feira/homolog/konnen/kit-volumetry-stack-audit.json`

### 6. **Validar Resultado**

Verificar no JSON:
```json
{
  "metrics": {
    "byFunctionalGroup": {
      "PIN LOADED": 10,
      "PLATE LOADED": 5,
      "CABLE CROSS": 2,
      "BENCHES & RACKS": 8,
      "ACESSORIOS": 15,
      "CARDIO": 7,
      "OUTROS": 0  ← ✓ ZERO
    }
  }
}
```

### 7. **Atualizar Relatório MD**

Editar `docs/feira/homolog/konnen/kit-volumetry-stack-audit.md`:
- Remover seção "## OUTROS (Não Classificados)"
- Se houver residual (<10), adicionar apêndice:
  
```markdown
## Apêndice: Residual (Se Aplicável)

SKU | Nome | Motivo | Grupo Atribuído
----|------|--------|----------------
ABC | XYZ | Nenhuma heurística capturou; nome genérico | ACESSORIOS (fallback)
...
```

### 8. **Commit (Quando Autorizado)**

```bash
git add src/lib/konnen-functional-group.ts src/lib/konnen-functional-group.test.ts
git commit -m "refactor: eliminate OUTROS functional group in Konnen audit

- Reorganize heuristics for 100% SKU coverage
- Add new prefixes: XMT*, XMR*, TN*, TB*, TM*, IF* (non-core)
- Implement hybrid name-based classification
- Add 100+ test cases for new rules
- Target: OUTROS = 0 in audit metrics
- Refs: faire/Konnen#audit"

git push
```

---

## 📊 Heurísticas Resumidas (Tabela)

| Prefixo | Exemplo | Grupo | Tipo |
|---------|---------|-------|------|
| FE97* | FE9701 | PIN LOADED | Prefixo exato |
| IF93* | IF9301 | PIN LOADED | Prefixo exato |
| IT95* | IT9501 | PIN LOADED | Prefixo exato |
| LCS* | LCS608 | PIN LOADED | Prefixo exato |
| AM80* | AM8012C | PIN LOADED | Prefixo exato |
| IFP* | IFPCP | PLATE LOADED | Prefixo exato |
| SL* | SL100 | PLATE LOADED | Prefixo exato |
| ECP* | ECP201 | PLATE LOADED | Prefixo exato |
| IFL* | IFLPHS | PLATE LOADED | Prefixo exato |
| RKC* | RKCPAD | ACESSORIOS | Prefixo exato |
| FEWS* | FEWS100 | ACESSORIOS | Prefixo exato |
| IF93WS* | IF93WS1 | ACESSORIOS | Prefixo exato |
| IT95WS* | IT95WS1 | ACESSORIOS | Prefixo exato |
| XMT* | XMT100 | ACESSORIOS | Prefixo exato (novo) |
| XMR* | XMR100 | ACESSORIOS | Prefixo exato (novo) |
| OKPRO* | OKPRO10 | ACESSORIOS | Prefixo exato |
| EC* | ECE5 | CARDIO | Prefixo exato |
| PS* | PS300 | CARDIO | Prefixo exato |
| HSR* | HSR005 | CARDIO | Prefixo exato |
| HB* | HB005 | CARDIO | Prefixo exato |
| V9* | V9000 | CARDIO | Prefixo exato (novo) |
| TN*/TB*/TM* | TNBENCH | Híbrido (nome) | Classificação por nome |
| IF* (não core) | IFBENCH | Híbrido (nome) | Classificação por nome |
| Qualquer | "...BENCH..." | BENCHES & RACKS | Nome |
| Qualquer | "...CABLE..." | CABLE CROSS | Nome |
| Qualquer | "...ATTACHMENT..." | ACESSORIOS | Nome |
| Qualquer | "...CARDIO..." | CARDIO | Nome |
| Fallback | Não classificado | ACESSORIOS | Default (com warning) |

---

## ✅ Checklist de Validação

- [ ] Testes passam 100% (`npm run test`)
- [ ] Audit regenerado sem erros (`npx tsx scripts/audit-konnen-kit-volumetry.ts`)
- [ ] JSON métrica: `OUTROS = 0` (ou ≤10 residual)
- [ ] Nenhum retorno é `'OUTROS'`
- [ ] RKC* continua ACESSORIOS
- [ ] PIN LOADED (FE97, IF93, IT95) intacto
- [ ] Relatório MD atualizado
- [ ] Nenhuma mudança em UI chips (apenas audit/docs)

---

## ⚠️ Pontos de Atenção

1. **Case Insensitivity:** Todos os regex usam `/i` — maiúscula/minúscula não importa
2. **Ordem de Precedência:** Prefixos exatos ANTES de classificação por nome
3. **Fallback Seguro:** Qualquer unclassified → ACESSORIOS (não há "OUTROS" para retorno)
4. **Logging:** Warnings em console para residual; documentar em appendix se >0
5. **Regressão:** Produtos reais do OOR 2024-09-29 testados (FE9701, IT9501, etc.)
6. **UI Separada:** Chips em `/feira` (IMPULSE, XMASTER, ROCKIT) **não mudam**; só audit funcional

---

## 📞 Debugging

Se algum SKU não classificar corretamente:

1. **Verificar prefixo:** `console.log(sku.substring(0, 3))`
2. **Verificar nome:** `console.log(name.toUpperCase())`
3. **Ordem de teste:**
   - Prefixo exato? (FE97, IF93, etc.)
   - Prefixo acessório? (RKC, FEWS, XMT, etc.)
   - Prefixo cardio? (EC, PS, V9, etc.)
   - Nome contém cable/bench/attachment/cardio?
   - Se não: fallback ACESSORIOS + warning

4. **Adicionar Teste:** Criar caso em `konnen-functional-group.test.ts` com SKU real

---

## 🎯 Critério de Sucesso

✅ **Objetivo Atingido se:**
- `konnenFunctionalGroup()` nunca retorna `'OUTROS'`
- Audit JSON: `metrics.byFunctionalGroup.OUTROS === 0` (ou ≤10 com justificativa)
- Testes Vitest 100% passando
- Nenhuma mudança em UI/chips
- Produtos reais OOR 2024-09-29 classificados corretamente

---

## 📖 Referências

- **OOR 2024-09-29:** 47 SKUs, 68 sets (68% Exoform, 32% Impulse)
- **Atual OUTROS:** Prefixos desconhecidos (XMT, TN, TB, TM, IF-híbrido, cardio residual)
- **Novo Schema:** 6 grupos válidos, 0 OUTROS

---

**Implementação pronta. Aguardando execução. ✨**
