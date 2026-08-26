# MIC factory scrapers

Padrão unificado para scrape logístico **Made-in-China** por fábrica OEM.

## Layout

```
scripts/mic-factories/
  factories.json              # índice global (Realleader, Tianzhan, BRTW…)
  requirements.txt            # playwright + beautifulsoup4
  _shared/
    mic_logistics.py          # listagem, detalhe, parsers, export JSON
    logistics_schema.json     # schema linha logística (fixture Buckler)
  _template/
    factory.json
    group.json
    scrape_group_logistics.py
  <factory-id>/
    factory.json              # baseUrl, delays, outputDir
    groups/
      <group-id>.json         # product-group path, expected count, catalogGroup
    scrape_<group>_logistics.py

docs/homolog/mic-factories/
  <factory-id>/
    <group-id>-logistics.json # export { rows: [...] } + metadata
```

## Saída (`rows[]`)

Cada linha segue o fixture `buckler-caixas-por-medida.json`:

| Campo | Origem MIC |
|-------|------------|
| `Item` | Model No. |
| `Produto` | Product name |
| `COMPRIMENTO/LARGURA/ALTURA` | Packing size |
| `Peso Bruto Total (kg)` | Gross weight |
| `Qtd. Caixas Total` | Carton qty |
| `URL_Origem` | detail URL |
| `MIC_Hash` | hash URL produto |

Wrapper export inclui `factoryId`, `groupId`, `catalogGroup`, `failures`.

## Setup (Python / Playwright)

```bash
pip install -r scripts/mic-factories/requirements.txt
playwright install chromium
```

## Tianzhan — GM Series (29 produtos)

**Fábrica:** Shandong Tianzhan Fitness Equipment Co., Ltd.  
**MIC:** `dezhoutianzhan.en.made-in-china.com`  
**Grupo:** GM Series (Pin Loaded Machine)

```bash
python scripts/mic-factories/tianzhan/scrape_gm_series_logistics.py
python scripts/mic-factories/tianzhan/scrape_gm_series_logistics.py --headed

# Smoke (3 produtos + validação qualidade)
python scripts/mic-factories/tianzhan/smoke_gm_series_logistics.py
python scripts/mic-factories/tianzhan/smoke_gm_series_logistics.py --limit=5
```

Saída: `docs/homolog/mic-factories/tianzhan/gm-series-logistics.json`

## Nova fábrica (checklist)

1. Copiar `_template/` → `scripts/mic-factories/<id>/`
2. Editar `factory.json` (`legalName`, `micSlug`, `baseUrl`)
3. Criar `groups/<line>.json` com `listPathPattern` (MIC product-group URL, `{page}` no slug)
4. Copiar `scrape_group_logistics.py` → `scrape_<line>_logistics.py`
5. Registrar entrada em `factories.json`
6. Rodar scrape → validar `expectedProducts` vs `scrapedProducts`

## Fábricas existentes (outros runtimes)

| id | Runtime | Scripts |
|----|---------|---------|
| `realleader` | TypeScript | `scripts/scrape-realleader-mic-catalog.ts`, `scrape-realleader-mic-product-specs.ts` |
| `brtw` / Ahead | TypeScript | `scripts/scrape-ahead-mic-catalog.ts`, `docs/homolog/Ahead/ahead-mic-factories.json` |

Migrar para `scripts/mic-factories/<id>/` quando houver grupo Playwright ou unificar export JSON.

## Delays / anti-block

Defaults em `factory.json` → `scrape`: 2.5–5s entre páginas, 3 retries, headless true.  
Debug: `--headed` no script Python.
