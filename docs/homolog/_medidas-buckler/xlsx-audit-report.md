# Medidas Buckler — auditoria XLSX (2026-08-20)

Fonte: `C:/Users/marce/Downloads/Medidas Buckler` (97 arquivos)

## Resumo

| Tipo | Qtd | SKUs únicos equip. |
|------|-----|-------------------|
| Planilha PDF | 80 | 141 |
| Planilha XLSX | 5 | 174 |
| Volumetria PDF | 10 | OK* acessórios |
| **Gap XLSX-only** | — | **36 SKUs** só nos Excel |

Pipeline antigo **ignorava .xlsx** → `RS-1036` e outros 35 SKUs nunca entraram no catálogo.

## RS-1036 — BLUE FIT 560 (e clones)

Presente **idêntico** em 5 planilhas Excel:

- `Planilha Dimensões - ABSOLUT GYM 426.xlsx`
- `Planilha Dimensões - BLUE FIT 560.xlsx`
- `Planilha Dimensões - INTERFIT 464 E 483.xlsx`
- `Planilha Dimensões - VIBE QUADRAMARES 477, 687 E 638.xlsx`
- `Planilha Dimensões - VOL DOISEAU 494.xlsx`

Aba **Base**, colunas:

| PRODUCT CODE | PRODUCT NAME | pilhas | CARTON QTY | Carton size(mm) | Gross kg | CBM |
|---|---|---:|---:|---|---:|---:|
| RS-1036 | FOREARM TENSION | — | 1 | 1200×850×380 | 59 | 0.4 |

**Zero** ocorrência de `RS-1036` em qualquer PDF planilha.

## 36 SKUs só no XLSX

```
FM-1004, FM-1006, FM-1007, FM-2003, FM-2005, FM-2006, FM-2008,
FW-1007, FW-1010, FW-1019, FW-2007, FW-2010, FW-2013, FW-2019, FW-2027, FW-2028, FW-2029,
M2-1016, M2-1021, PF-1008,
RS-1002, RS-1004, RS-1013, RS-1014, RS-1018, RS-1019, RS-1021, RS-1024, RS-1025, RS-1026,
RS-1036, RS-1040, RS-1041, RS-1045, RS-1046, RS-1050
```

Regra merge: **PDF prevalece** quando SKU existe nos dois (mais caixas A/B/C). XLSX preenche lacunas.

## Pós-fix catálogo

`build-buckler-catalog-from-medidas.ts` lê PDF + XLSX → **340 SKUs**, **905 rows**.

Jungle 2139: **45/46** match — falta só `FW-1011` (existe `FW-2012` LYING T-BAR ROW nos PDF/XLSX).

## Scripts

```bash
npx tsx scripts/_audit-medidas-xlsx-gap.ts
npx tsx scripts/_scan-medidas-buckler.ts --sku=RS-1036
npx tsx scripts/build-buckler-catalog-from-medidas.ts --write-fixture
```
