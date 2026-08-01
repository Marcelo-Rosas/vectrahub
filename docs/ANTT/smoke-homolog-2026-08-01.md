# ANTT Hub — Smoke Homologação RNTRC

**Data:** 2026-08-01  
**Projeto:** `lrbtbrpoklgwaaclbufz` (Vectra HUB)  
**PDFs de referência:** `docs/ANTT/emitircertificado 49.pdf`, `docs/ANTT/emitirextrato 49.pdf`

## Emitente (esperado)

| Campo | Valor |
|-------|-------|
| Razão | VECTRA HUB LTDA |
| CNPJ | `62188748000117` |
| RNTRC | `059734055` |
| Categoria | ETC |
| Situação | ATIVO / apto |
| Placa frota | SVC-2F44/SP |

## Secrets

- `VECTRA_CNPJ=62188748000117`
- `VECTRA_RNTRC=059734055`
- `VECTRA_NOME=VECTRA HUB LTDA`

Confirmado via `supabase secrets list` (nomes presentes).

## Fix aplicado no scraper

Portal rejeitava postback (`Invalid postback / EventValidation`) no `operation=rntrc`.

Em `supabase/functions/antt-rntrc-check/index.ts`:

- Autopostback de radio também para tipo=1 (Por Transportador)
- `txtPlaca` só enviado quando tipo=3
- Retry de EventValidation para ambos os tipos

Função redeployada antes dos smokes.

## Smoke A — `operation=rntrc`

**Request:** CNPJ `62188748000117`, RNTRC `059734055`, placa `SVC2F44` (obrigatória no handler), `order_id` dummy.

**Resultado:** PASS (~2.0s)

| Campo | Valor |
|-------|-------|
| situacao | `regular` |
| situacao_raw | `ATIVO` |
| rntrc | `059734055` |
| transportador | `ETC - Vectra Hub Ltda` |
| apto | `true` |
| cadastrado_desde | `31/07/2026` |
| municipio_uf | `Itajaí/SC` |
| rntrc_registry_type | `null` (ETC já no nome) |

Raw: `docs/ANTT/smoke-rntrc-raw.json`

## Smoke B — `operation=veiculo`

**Request:** placa `SVC2F44`, CNPJ Hub, RNTRC Hub.

**Resultado:** PASS (~1.7s)

| Campo | Valor |
|-------|-------|
| situacao | `regular` |
| situacao_raw | `ATIVO` |
| veiculo_na_frota | `true` |
| apto | `true` |
| rntrc | `059734055` |
| transportador | `ETC - Vectra Hub Ltda` |

Raw: `docs/ANTT/smoke-veiculo-raw.json`

## UI / PDF (C — Risk panel + OC PDF)

**Script:** `npx tsx scripts/smoke-antt-hub-pdf-ui.ts`  
**Resultado:** PASS (`docs/ANTT/smoke-ui-pdf-assert.json`)

### B — PDF Ordem de Coleta

Gerado a partir do snapshot smoke (mesmo contrato do `generateCollectionOrderPdf` na UI).

| Artefato | Path |
|----------|------|
| PDF | `docs/ANTT/smoke-oc-hub-antt.pdf` |
| Assert strings | `CONSULTA ANTT / RNTRC`, `059734055`, `ATIVO`, `ETC`, `Vectra Hub`, `31/07/2026`, APTO `SIM` |

Campos batem com certificado/extrato Hub.

### A — Painel Risk (Passo 1 ANTT)

Espelho HTML do card do `RiskWorkflowWizard` (sem login SPA — mesmos campos do payload).

| Artefato | Path |
|----------|------|
| HTML | `docs/ANTT/smoke-risk-antt-panel.html` |
| PNG | `docs/ANTT/smoke-risk-antt-panel.png` |

Mostra: Consulta válida · Vectra Hub Ltda · RNTRC `059734055` · regular · ETC · Itajaí/SC · apto + frota SVC2F44.

### Comprovante PDF (link)

`comprovante_url` continua **null**. Consulta pública não devolve link de certidão/extrato (esses PDFs saem do portal autenticado “emitir certificado/extrato”). Na UI: link “Ver Comprovante ANTT” **não aparece** — comportamento esperado hoje.

**Ainda não feito:** walkthrough logado no SPA (OrderDetail → Risk wizard → emitir OC real). Espelho + gerador cobrem contrato de dados/PDF.

## Conclusão

RNTRC Hub consultável e coerente com certificado/extrato. Secrets emitente prontos para CT-e/MDF-e homolog. Bloco ANTT no PDF OC + painel Risk validados via smoke script.

**Fora deste smoke:** emissão CIOT (bridge STUB / IPEF WebRouter); link comprovante na consulta pública.
