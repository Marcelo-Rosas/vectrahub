# Spike — Dados Abertos ANTT: frota / equiparado por RNTRC

**Data:** 2026-08-02  
**Pergunta:** dá pra contar veículos de tração por RNTRC via Dados Abertos?

## Resposta curta

| Dataset | Conta tração por RNTRC? | Serve p/ CIOT equiparado? |
|---------|-------------------------|---------------------------|
| **RNTRC — Transportadores** (mensal, ~150 MB) | **Não precisa contar** — tem flag oficial `equiparado` | **SIM** — caminho certo |
| **RNTRC — Veículos** (~11 MB CSV) | **NÃO** — só agregado (categoria × UF × ano × qtd) | Não |

**Não scrapear extrato** p/ contar placas. Usar `equiparado = Sim|Não` no dump de transportadores.

---

## Evidência

### 1. Transportadores (`transportadores_rntrc_06_2026.csv`)

- CKAN: [dataset rntrc](https://dados.antt.gov.br/dataset/rntrc) — recurso **Jun26 - RNTRC**
- URL exemplo: `.../download/transportadores_rntrc_06_2026.csv` (~149 MB)
- Colunas:

```
nome_transportador; numero_rntrc; data_primeiro_cadastro; situacao_rntrc;
cpfcnpjtransportador; categoria_transportador; cep; municipio; uf;
equiparado; data_situacao_rntrc
```

- Dicionário oficial: `equiparado` = **SIM** se ETC com **até 3 veículos automotores** na frota; **NÃO** demais casos.
- Jun/2026 parse (`parse-transportadores.cjs`):

| Métrica | Valor |
|---------|------:|
| Linhas | 1 142 227 |
| `equiparado=Sim` | 210 982 |
| `equiparado=Não` | 931 245 |
| ETC / TAC / CTC | 321 619 / 820 066 / 542 |
| ATIVO | 892 819 |

- CNPJ de ETC vem **completo** (não anonimizado). Lookup por RNTRC **ou** CNPJ.
- Exemplo equiparado: RNTRC `050085788` → ETC, `equiparado=Sim`, ATIVO.

**Vectra Hub** RNTRC `059734055` / CNPJ `62188748…`: **ausente** no dump Jun/2026 (cadastro público ~31/07/2026 → cai no snapshot Jul/Ago). Outras “Vectra*” no arquivo não são a Hub.

### 2. Veículos (`rntrc-veiculos.csv` / `.json`)

Colunas: `Categoria do Transportador; Tipo de Veículo; UF; Categoria; Carroceria; Ano; Quantidade`.

Sem `numero_rntrc`, sem CNPJ, sem placa. Ex.: “CTC + Implemento + AC + SEMI-REBOQUE + ano + qtd”.  
**Impossível** somar tração por transportador.

### 3. Consulta pública Hub (`antt-rntrc-check`)

Só regularidade + tipo + `veiculo_na_frota` p/ **1 placa**. Não lista frota.

---

## Arquitetura recomendada (Hub)

```
npm run rntrc:ingest
  → CKAN package rntrc (CSV transportadores mais recente)
  → RPC rntrc_open_data_truncate
  → insert batches → public.rntrc_open_data

Lookup:
  RPC lookup_rntrc_open_data(p_rntrc, p_cnpj)
  ou src/lib/rntrcOpenData.ts
```

**Implementação (2026-08-02):** migration + script + helper — ver §3 do MODELO-DOMINIO-CIOT.

---

## Artefatos locais (não commitar CSV grande)

Pasta: `docs/ANTT/spike-dados-abertos/`

| Arquivo | Commit? |
|---------|---------|
| `SPIKE-REPORT.md` (este) | Sim |
| `parse-transportadores.cjs` | Sim |
| `dicionario_dados_rntrc.pdf` | Opcional |
| `transportadores_rntrc_06_2026.csv` (~149 MB) | **Não** — `.gitignore` |
| `rntrc-veiculos.csv` / `.json` | **Não** |

---

## Conclusão

1. Contar tração por RNTRC via dataset **Veículos** → **não**.  
2. Classificar ETC ≤3 via Dados Abertos → **sim**, campo `equiparado`.  
3. Melhor que inventar contagem: flag ANTT mensal + fallback p/ RNTRC fresco.
