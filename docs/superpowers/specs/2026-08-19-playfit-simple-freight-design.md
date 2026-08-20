# Design — PlayFit frete feira (tenant)



**Data:** 2026-08-19  

**Status:** revisado — catálogo PBR só em `/feira` (não simples); aguardando plano implementação  

**Tenant ref:** `docs/superpowers/tenants/playfit.md`  

**Site embarcador:** [playfitpisos.com.br](https://playfitpisos.com.br/)



## 1. Objetivo



PlayFit no app feira com **duas superfícies**:



| Rota | UI | Conteúdo |

|------|-----|----------|

| `/feira/simples` | `PlayFitSimpleFreightCalculator` | Rápido: filial, CEP, **m²**, NF, badge 50/60/80 — **sem catálogo SKU** |

| `/feira` | `FairQuoteCalculator` + catálogo PlayFit | SKU **PBR-PALLET**, `FairQtyStepper`, badge montagem 50/60/80 |



Motor comum `playfit-pallet-gate.ts` estende gate feira (lotação / fracionado + `calculate-freight`). MVP: calcular + salvar + PDF + promote Hub.



**Auth:** cadastro só via Edge `tenant-signup` — e-mail ∈ `feira.companies.email_domains`.



## 2. Decisões fechadas



| Tópico | Decisão |

|--------|---------|

| Simples | m² + badge montagem — **sem** linha catálogo / stepper SKU |

| Catálogo (`/feira`) | SKU `PBR-PALLET` + qty pallets + badge 50/60/80 |

| Peso | `peso_kg = m² × 14` (simples e catálogo) |

| Badge 50/60/80 | Volume m³/pallet; **não** altera teto pallets/caminhão |

| Veículo dedicado | `max_pallets` fixo por código veículo + capacidade kg |

| Origem | Select filial (Fortaleza, Recife, Salvador, fábrica) |

| Escopo | Calcular + salvar + PDF + promote Hub |

| Abordagem | `playfit-pallet-gate.ts` compartilhado; branch UI por rota |



## 3. Arquitetura



```

FairSimpleQuotePage (/feira/simples)

  └─ tenant.slug === 'playfit' ?

       PlayFitSimpleFreightCalculator   ← sem catálogo

       : FairSimpleFreightCalculator



FairQuotePage (/feira)

  └─ tenant.slug === 'playfit' ?

       FairQuoteCalculator + PlayFit catalog hooks (PBR-PALLET)

       : fluxo Konnen/Buckler atual



playfit-pallet-gate.ts (shared)

  ├─ playfitLoadMetrics()

  └─ playfitFreightGate() → fairFreightGate + vehicle by pallets

```



**Isolamento:** lógica PlayFit em `src/lib/playfit-*.ts`; Konnen/Buckler inalterados.



## 4. Tenant & metadata



### 4.1 Migration `feira.companies`



Row `slug = playfit`:



- `name`: PlayFit Pisos

- `email_domains`: `{playfitpisos.com.br}` *(confirmar)*

- `event_flag`: `PLAYFIT` *(confirmar)*

- `origin_*`: default fábrica (placeholder CEP)

- `toll_fallback_percent`: 12



### 4.2 Config versionada



`src/lib/playfit-tenant-config.ts` + espelho `docs/superpowers/tenants/playfit.md`.



```ts

type PlayFitBranch = { id: string; label: string; originCep: string; originCity: string; originUf: string };

type PlayFitPalletProfile = { platesPerPallet: 50 | 60 | 80; volumeM3PerPallet: number };

type PlayFitTenantConfig = {

  kgPerM2: 14;

  m2PerPlate: number;

  cubageFactor: 300;

  palletProfiles: PlayFitPalletProfile[];

  maxPalletsByVehicleCode: Record<string, number>;

  branches: PlayFitBranch[];

};

```



**TBD homolog:** `m2PerPlate`, `volumeM3PerPallet` por badge, `maxPalletsByVehicleCode`, CEP filiais.



### 4.3 Brand



- Logo: `public/brand/playfit-logo.svg`

- Paleta: `resolveFairPalette('playfit')` (seed Brandfetch offline)

- Slug em `FairBrandPalette` union



### 4.4 Catálogo `feira.products` — **só rota `/feira`**



Seed:



| Campo | Valor |

|-------|-------|

| `sku` | `PBR-PALLET` |

| `name` | Pallet PBR |

| `company_id` | PlayFit UUID |



**UI catálogo (`FairQuoteCalculator` branch PlayFit):**



- Linha `PBR-PALLET` + **`FairQtyStepper`** (qtd pallets)

- **`ToggleGroup`** 50 · 60 · 80 placas/pallet

- **m²** campo separado — peso = m² × 14

- Sync: m² manda peso; pallets recalculam de m²+badge; override manual no stepper com aviso se divergir



**Simples não consome `feira.products` na UI** — motor usa m² + badge direto.



## 5. UI



### 5.1 Simples (`/feira/simples`) — PlayFit



| Campo | Componente |

|-------|------------|

| Filial origem | `Select` + `Field` |

| CEP destino | `Input` CEP |

| Metragem (m²) | `Input` decimal |

| Valor NF | `MaskedInput` currency |

| Montagem pallet | `ToggleGroup` 50 · 60 · 80 |



**Não exibir:** SKU, `FairQtyStepper` catálogo, peso manual, forçar perfil.



Pallets estimados = read-only no `FairFreightProfileCard`.



### 5.2 Catálogo (`/feira`) — PlayFit



Tudo do §5.1 **mais**:



| Campo | Componente |

|-------|------------|

| Pallet PBR (`PBR-PALLET`) | card catálogo |

| Qtd pallets | `FairQtyStepper` |



Reuso `FairClientFields`, save/PDF/promote igual feira catálogo.



### 5.3 Card perfil (ambas rotas)



Read-only: peso, pallets, volume m³, veículo, alertas, badges Dedicado/Fracionado.



## 6. Motor `playfitFreightGate`



```

plates     = ceil(m2 / m2PerPlate)

pallets    = palletQty ?? ceil(plates / platesPerPallet)   // catálogo: stepper; simples: auto

weightKg   = m2 * kgPerM2

volumeM3   = pallets * volumeM3PerPallet[badge]

```



Gate base: `fairFreightGate({ weightKg, volumeM3, manualMode: 'auto' })`.



Dedicado: menor veículo em ladder com `capacityKg >= billable` **e** `maxPallets[code] >= pallets`.



Fracionado: `suggestedVehicle = null`.



## 7. Persistência



### 7.1 Simples — `feira.quote_lines`



Linha sintética (sem SKU catálogo na UI):



- `sku`: `PLAYFIT-M2`

- `quantity`: m²

- `boxes_count`: pallets estimados

- breakdown JSON: badge, filial, pallets



### 7.2 Catálogo — `feira.quote_lines`



- `sku`: `PBR-PALLET`

- `quantity`: pallet qty (stepper)

- badge em breakdown / `selected_box_types`

- `weight_kg`, `volume_m3`, `boxes_count`: totais



### 7.3 `pricing_breakdown.playfit`



```json

{

  "m2": 2500,

  "palletQty": 84,

  "platesPerPallet": 60,

  "branchId": "recife",

  "source": "simples | catalogo",

  "sku": "PLAYFIT-M2 | PBR-PALLET"

}

```



## 8. PDF & promote



- PDF: bloco PlayFit (m², badge, pallets, filial); pedágio incluso

- Promote: simples → `PLAYFIT-M2`; catálogo → `PBR-PALLET`



## 9. Testes



- `playfit-pallet-gate.test.ts` — motor compartilhado

- smoke `/feira/simples` e `/feira` tenant PlayFit



## 10. Fora de escopo



- Catálogo multi-SKU / import Konnen

- Edge Function dedicada

- Rota `/playfit/*` separada

- Tabela preço PlayFit própria



## 11. Ordem implementação



1. Migration tenant + seed `PBR-PALLET` + palette/logo  

2. `playfit-pallet-gate.ts` + tests  

3. `PlayFitSimpleFreightCalculator` (simples, sem catálogo)  

4. Branch PlayFit em `FairQuoteCalculator` (catálogo PBR)  

5. Save / PDF / promote por rota  

6. `deploy:feira`



## 12. Self-review



- [x] Catálogo PBR **somente** `/feira` — simples limpo conforme usuário  

- [x] Motor único; divergência só persistência SKU  

- [x] Constantes TBD explícitas


