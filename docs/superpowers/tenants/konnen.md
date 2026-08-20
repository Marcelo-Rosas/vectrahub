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

**Catálogo:** há rows em `feira.products` neste `company_id`, mas packing **incompleto** (linhas Impulse/Xmaster/Rockit fundidas; SKUs/caixas a auditar). UI não deve cair em fixture.

**Clientes:** só `feira.clients`. Contratos CIF/FOB Hub não leem esta tabela.
