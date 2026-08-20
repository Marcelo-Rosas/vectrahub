# Tenant Feira — Konnen Fitness

Fonte: `feira.companies`.

| Campo | Valor |
|---|---|
| id | `0c28d840-6076-4e72-b3be-b13195121686` |
| slug | `konnen` |
| name | Konnen Fitness |
| origin | Itajaí - SC (`88317100`) |
| email_domains | `konnenfitness.com.br` |
| event_flag | `IHRSA-KONNEN` |
| toll_fallback_percent | 12 |
| price_table_id | null |

**IHRSA comercial âncora = Buckler.** Konnen existe no schema para multi-tenant.

**Catálogo:** `feira.products` por `company_id`. Chips UI: **IMPULSE** (AC/IF/IFP/SL/FE/TN/TB + FEWS weight plate), **XMASTER** (`XMT*`), **ROCKIT** (`RKC*`). `IT95WS-*` = alias do mesmo WEIGHT PLATE que `FEWS-*` → some da lista se FEWS já existe.

**Clientes:** só `feira.clients`. Contratos CIF/FOB Hub não leem esta tabela.
