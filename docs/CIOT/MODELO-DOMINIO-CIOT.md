# Modelo de domínio CIOT — Vectra Hub

**Status:** decisões fechadas (2026-08-02) — base para skill `agente-ciot` e implementação.  
**Fontes:** Res. ANTT 5.862/2019 (+ 6.078/2026), manual e-FRETE v8.1 §A.3, operação Vectra.

---

## 1. Elo contratual padrão (fechado)

```
Embarcador  →  Vectra Hub (ETC)  →  TAC ou ETC (executor)
                 contratante            contratado
```

| Papel CIOT | Quem | Doc |
|------------|------|-----|
| **Contratante** | Vectra Hub Ltda | CNPJ `VECTRA_CNPJ` / emitente |
| **Contratado** | Executor do frete (TAC PF ou ETC/CTC) | CPF/CNPJ + RNTRC do **owner/driver contratado** |
| **Motorista** | Condutor da viagem | CPF em `drivers` — **≠** contratado se ETC |

Responsável pela emissão do CIOT = **Vectra (contratante)**.  
Delegação de digitação ao TAC **não** transfere multa.

**Não modelar** (por enquanto) cenário “embarcador contrata TAC direto” — fora do fluxo Hub.

---

## 2. Elegibilidade / `ciot_obrigatorio`

### Categorias do contratado

| Categoria RNTRC | Frota (veículos de tração no RNTRC) | CIOT? |
|-----------------|-------------------------------------|-------|
| TAC | — | **Sim** |
| ETC equiparada | ≤ 3 | **Sim** |
| CTC | qualquer | **Sim** |
| ETC padrão | &gt; 3 | **Não** como *contratado* direto (Art. 25-A); se Vectra subcontrata TAC, CIOT segue no elo Vectra→TAC |

### Hub hoje (gap)

- Enum `rntrc_registry_type`: só `TAC` \| `ETC`
- Badge: ETC = sempre “CIOT dispensado” → **errado** para equiparada
- Sem `fleet_count` / sem `CTC`

### Regra alvo

```
ciot_obrigatorio(contratado) =
  categoria ∈ { TAC, CTC }
  OR (categoria = ETC AND frota_tracao_rntrc ≤ 3)
  OR (sempre que o executor da OS for TAC/equiparado no elo Vectra→executor)

ciot_dispensado =
  contract_type = proprio   // frota Vectra (raro)
  OR contratado ETC com frota > 3 E sem TAC na ponta
```

Operação Vectra asset-light → **quase sempre CIOT obrigatório**.

---

## 3. Contagem de frota (ETC ≤ 3) — viabilidade técnica

Necessário para classificar **ETC equiparada**. Spike 2026-08-02: [`docs/ANTT/spike-dados-abertos/SPIKE-REPORT.md`](../ANTT/spike-dados-abertos/SPIKE-REPORT.md).

| Fonte | O que entrega | API? | Uso Hub |
|-------|---------------|------|---------|
| **Consulta pública** `antt-rntrc-check` | Situação, tipo, RNTRC, `veiculo_na_frota` p/ **1 placa** | Scrape ASP.NET | **Não** lista frota |
| **Extrato PDF** autenticado | Frota completa | Sem API pública | Só referência humana |
| **Dados abertos — Transportadores** (mensal) | `numero_rntrc`, CNPJ, `categoria`, **`equiparado` (Sim/Não = ETC ≤3 automotores)** | CSV CKAN ~150 MB | **Caminho certo** — lookup, não contar |
| **Dados abertos — Veículos** | Agregado categoria×UF×ano×qtd | CSV/JSON | **Inútil** p/ RNTRC (sem chave) |
| **e-FRETE na emissão** | Aceita/rejeita | Indireto | Pós-validação |

**Conclusão (spike):**

1. Contar tração por RNTRC no dataset Veículos → **não dá**.  
2. Flag oficial `equiparado` no dump Transportadores → **dá** (Jun/2026: ~211k Sim / ~931k Não).  
3. **Implementado:** tabela `rntrc_open_data` + RPC `lookup_rntrc_open_data` / `rntrc_open_data_truncate`  
   (`supabase/migrations/20260802120000_rntrc_open_data.sql`).  
4. **Job:** `npm run rntrc:ingest` → `scripts/ingest-rntrc-open-data.ts` (CKAN latest CSV → truncate+insert).  
5. **Helper UI/edge:** `src/lib/rntrcOpenData.ts` (`lookupRntrcOpenData`, `ciotObrigatorioFromOpenData`).  
6. Cadastro recente fora do dump → fallback `owners.is_tac_equiparado` (ainda a criar) + alerta.  
7. **Não** scrapear extrato autenticado.

---

## 4. TipoViagem (fechado)

| Caso Vectra | `TipoViagem` e-FRETE | Notas |
|-------------|----------------------|-------|
| Viagem avulsa (padrão) | **`Padrao`** (Lotação ANTT) | Default de implementação |
| ≥2 contratantes CNPJ distintos no mesmo embarque | **`Fracionado`** | Ver §5 piso |
| TAC com várias OS em janelas longas (não “pacote 30 dias”) | Continuar **`Padrao` por viagem** | **Não** forçar `TAC_Agregado` |
| `TAC_Agregado` | Só se produto/contrato explícito ≤30 dias | Fora do MVP; backlog |

`contract_type = agregado` (vínculo comercial Hub) **≠** `TipoViagem = TAC_Agregado`.

---

## 5. Valor do frete no CIOT (fechado)

| Campo | Papel |
|-------|--------|
| `orders.carreteiro_real` | **Valor declarado no CIOT** (frete do executor) — obrigatório p/ gerar |
| `orders.carreteiro_antt` | Piso / referência |
| `orders.value` | Frete embarcador — **proibido** no payload CIOT |

### Gates

1. **Sempre (Padrao):**  
   `carreteiro_real` preenchido; se `carreteiro_antt` conhecido → `carreteiro_real >= carreteiro_antt` (salvo override homolog).

2. **Fracionado (2+ CNPJs contratantes distintos no mesmo embarque):**  
   - `TipoViagem = Fracionado`  
   - Manual: fracionado **não** observa piso no valor do frete da mesma forma que lotação  
   - Regra Vectra: mesmo assim **gate interno** `carreteiro_real >= carreteiro_antt` (mínimo operacional) antes de emitir CIOT  
   - Payload: `ContratantesCargaFracionada` com CNPJs adicionais

3. **Pedágio:** `Valores.Pedagio` = `toll_value` (ou 0 se rota sem praças) — **nunca** embutir no `carreteiro_real`.

---

## 6. Mapa mínimo payload (alvo)

| e-FRETE / lei | Fonte Hub |
|---------------|-----------|
| MatrizCNPJ / Contratante | `VECTRA_CNPJ` |
| Contratado doc + RNTRC | Owner/driver da OS (CPF/CNPJ + `antt`/`owners.rntrc`) |
| Motorista CPF | `drivers.cpf` |
| Placa | `orders.vehicle_plate` |
| TipoViagem | Padrao \| Fracionado (regra §4) |
| TotalViagem / frete | `carreteiro_real` |
| Pedagio | `toll_value` ou 0 |
| Distância | `km_distance` |
| IBGE/CEP | quote/OS (gap atual — preencher antes prod) |
| Datas | coleta / previsão entrega OS |
| NCM | NF-e / prodPred (já no fluxo fiscal) |
| TipoPagamento MVP | `TransferenciaBancaria` + PIX/banco do contratado (`owners`) |
| IdOperacaoCliente | `orders.id` |
| CIOT → MDF-e | `orders.ciot_number` → `modal_rodoviario.ciot[]` |

---

## 7. Gates de processo (alvo)

1. `ciot_obrigatorio` e sem `ciot_number` → **bloquear emit MDF-e** (multa Res. 6.078 art. 19 I “h”).  
2. Ideal: bloquear avanço a `em_transito` sem CIOT quando obrigatório.  
3. Rota sem praças → VPO omitido no MDF-e **e** `Pedagio=0` no CIOT (mesma regra `isTollFreeRoute`).

---

## 8. Fora do MVP emit (contexto só)

- Retenções IRRF/INSS/SEST + eSocial/Reinf  
- Modalidade PEF `eFRETE` com saldo (homolog Nstech: documentar stub da 2ª via)  
- `TAC_Agregado` como produto

---

## 9. Próximos artefatos

1. Corrigir regra badge/gate ETC equiparada (campo frota manual ou snapshot).  
2. Reescrever montagem `generate-ciot` (papéis + `carreteiro_real`).  
3. Skill `agente-ciot` apontando **este** doc.  
4. Spike Dados Abertos ANTT → contagem frota (opcional).
