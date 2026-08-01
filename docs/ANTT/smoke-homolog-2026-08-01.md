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

## Conclusão

RNTRC Hub consultável e coerente com certificado/extrato. Secrets emitente prontos para CT-e/MDF-e homolog.

**Fora deste smoke:** emissão CIOT (bridge STUB / IPEF WebRouter).
