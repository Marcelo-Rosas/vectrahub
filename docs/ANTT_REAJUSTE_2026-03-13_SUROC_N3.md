# Reajuste ANTT — Portaria SUROC N.3 de 13/03/2026

**Fonte**: [DOU - Portaria SUROC N.3](https://www.in.gov.br/en/web/dou/-/portaria-suroc-n-3-de-13-de-marco-de-2026-692638596)
**Tabela**: A (Lotacao sem carga de retorno)
**Tipo de carga**: Carga Geral
**Vigencia anterior**: Res. 6.076/2026 (desde 20/01/2026)
**Vigencia nova**: Portaria SUROC N.3 (a partir de 13/03/2026)

---

## Comparativo CCD (R$/km)

| Eixos | CCD Anterior | CCD Novo | Delta |
|-------|-------------|----------|-------|
| 2     | 3,6815      | 3,8866   | +5,57% |
| 3     | 4,7062      | 4,9762   | +5,74% |
| 4     | 5,3386      | 5,6443   | +5,73% |
| 5     | 6,1604      | 6,5126   | +5,72% |
| 6     | 6,7774      | 7,1824   | +5,98% |
| 7     | 7,4902      | 7,8952   | +5,41% |
| 9     | 8,5104      | 8,9799   | +5,52% |

**Media de aumento CCD**: ~5,67%

## CC (Custo Fixo) — Sem alteracao

| Eixos | CC (R$)  |
|-------|----------|
| 2     | 436,39   |
| 3     | 523,33   |
| 4     | 568,72   |
| 5     | 635,08   |
| 6     | 648,95   |
| 7     | 803,22   |
| 9     | 872,44   |

## Impacto no custo total (simulacao 1.000 km)

| Eixos | Custo Anterior (R$) | Custo Novo (R$) | Delta |
|-------|--------------------:|----------------:|-------|
| 2     | 4.117,89            | 4.322,99        | +4,98% |
| 3     | 5.229,53            | 5.499,53        | +5,16% |
| 4     | 5.907,32            | 6.213,02        | +5,17% |
| 5     | 6.795,48            | 7.147,68        | +5,18% |
| 6     | 7.426,35            | 7.831,35        | +5,45% |
| 7     | 8.293,42            | 8.698,42        | +4,88% |
| 9     | 9.382,84            | 9.852,34        | +5,00% |

**Media de aumento no custo total (1.000 km)**: ~5,12%

## Observacoes

- Apenas o CCD (componente variavel por km) sofreu reajuste
- O CC (custo fixo de carga/descarga) permaneceu inalterado
- O impacto percentual no custo total e menor que o reajuste do CCD porque o CC fixo dilui o aumento
- Rotas mais longas sentem mais o impacto (maior peso do CCD no custo total)
- Para rotas curtas (<200 km), o impacto e menor (~3-4%) devido ao peso do CC fixo

## Banco de dados

- Registros anteriores expirados com `valid_until = 2026-03-12`
- Novos registros inseridos com `valid_from = 2026-03-13`
- Query `getAnttFloorRate()` usa `ORDER BY valid_from DESC LIMIT 1` — pega automaticamente o mais recente
- Tabela: `antt_floor_rates` (operation_table='A', cargo_type='carga_geral')

---

## Atualização SUROC Nº 4 — 20/03/2026 (substitui Nº 3 para Tabela A)

**Fonte**: [DOU - Portaria SUROC N.4](https://www.in.gov.br/web/dou/-/portaria-suroc-n-4-de-20-de-marco-de-2026-694437180)

| Eixos | CCD Novo (R$/km) | CC (R$) — inalterado |
|-------|------------------|----------------------|
| 6     | **7,4124**       | 648,95               |
| 9     | **9,2466**       | 872,44               |

Exemplo calculadora oficial: `2756 × 7,4124 + 648,95 = R$ 21.077,52` (6 eixos, Tabela A).

**Script**: `npx tsx scripts/apply-antt-suroc-n4-2026.ts --apply`

**Mapeamento tabela (paridade calculadorafrete.antt.gov.br)**:
- Composição veicular = Sim → **Tabela A** (não B)
- Apenas unidade de tração → **Tabela B**

---

## Resolução ANTT nº 6.084/2026 — 16/07/2026 (DOU 17/07/2026)

**Fonte**: [DOU - Resolução 6.084/2026](https://www.in.gov.br/web/dou/-/resolucao-antt-n-6.084-de-16-de-julho-de-2026-719732378)

Substitui o Anexo II inteiro (tabelas A–D). CCD **e** CC mudam.

| Eixos | CCD (Tabela A, carga geral) | CC (R$) |
|-------|-----------------------------|---------|
| 6     | **7,3547**                  | **671,93** |

Paridade calculadora oficial: `2245 × 7,3547 + 671,93 = R$ 17.183,23`.

**Dados**: `data/antt_res_6084_2026_anexo_ii.json`
**Script**: `npx tsx scripts/apply-antt-res-6084-2026.ts --apply`
**Fórmula** (não muda): `ceil(km) × CCD + CC` em `src/lib/antt-floor-calc.ts`. `src/lib/carreteiro-cost.ts` só lê o snapshot.
