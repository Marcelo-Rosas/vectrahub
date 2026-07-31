# Vectra HUB — Environment checklist

## Identidade

| Item | Valor |
|---|---|
| Empresa | VECTRA HUB LTDA |
| CNPJ | 62.188.748/0001-17 (`62188748000117`) |
| IE | 263768406 |
| GitHub | https://github.com/Marcelo-Rosas/vectrahub |
| Local | `C:\Users\marce\vectra-hub` |
| Supabase ref | `lrbtbrpoklgwaaclbufz` |
| Supabase URL | https://lrbtbrpoklgwaaclbufz.supabase.co |
| Região | sa-east-1 |
| Cloudflare Pages | `vectrahub` |

## Secrets GitHub Actions (`vectrahub` repo)

- `VITE_SUPABASE_URL` = `https://lrbtbrpoklgwaaclbufz.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = anon Hub
- `SUPABASE_ACCESS_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SUPABASE_DB_URL` (opcional, pooler Hub)

## Local

- `.env` gitignored (copiado de `.env.txt` no bootstrap)
- Upstream Cargo: remote `cargo-upstream`
- Origin Hub: remote `origin` → `Marcelo-Rosas/vectrahub`

## Sync Cargo → Hub

Default: cherry/PR manual de features compartilhadas.  
Não apontar CI do Cargo para este projeto.

## Plano

`docs/superpowers/plans/2026-07-31-vectra-hub-tenant-path-a.md`
