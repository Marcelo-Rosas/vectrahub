# Tenant Feira — Rotha Fitness

Fonte: `feira.products` + planilha **Produtos (10).xlsx** homolog + [rothafitness.com](https://rothafitness.com/).

| Campo | Valor |
|-------|-------|
| slug | `rotha` |
| name | Rotha Fitness |
| CNPJ | 43.466.166/0001-00 |
| site | [rothafitness.com](https://rothafitness.com/) |
| origem | Taboão da Serra - SP (`06765350`) |
| email_domains | `rothafitness.com` |
| brand API | Edge `feira-resolve-brand` + cache `feira.company_brands` |
| event_flag | `ROTHA` |

## Catálogo (kits logísticos)

Cada SKU = **1 kit completo** (pares agregados). UI usa `FairQuoteCalculator` padrão (não PlayFit).

| SKU | Composição (pares) | Peso kit (kg) | m³ kit |
|-----|-------------------|---------------|--------|
| `ROTHA-KIT-HALTER-1-10` | 1–10 kg (passo 1 kg) | 110 | 0,200 |
| `ROTHA-KIT-DB-12-25` | 12,5–25 kg (passo 2,5 kg) | 225 | 0,220 |
| `ROTHA-KIT-DB-12-35` | 12,5–35 kg | 475 | 0,460 |
| `ROTHA-KIT-DB-12-40` | 12,5–40 kg | 630 | 0,520 |
| `ROTHA-KIT-DB-42-50` | 42,5–50 kg | 370 | 0,160 |

**Pendente homolog:** kits 52–60 e 62–70 kg (sem linha na planilha AB6051 >50 kg).

## Fórmulas

```
Peso kit = Σ (peso par × 2) para cada peso no intervalo
Cubagem kit = Σ m³ unitário por par (coluna M³ da planilha)
```

## Rotas UI

| Rota | UI |
|------|-----|
| `/feira` | `FairQuoteCalculator` + catálogo DB |
| `/feira/simples` | Frete manual (sem catálogo Rotha dedicado) |

## Homolog

- PDF catálogo 2025–2026 é imagem — extrair dimensões caixa quando OCR disponível
- Validar pesos/cubagem com comercial Rotha antes feira
