# Plano — Migração do Hub para o projeto Supabase novo

## Mode: Standalone
Report: none · Report age: n/a · Staleness warnings: none

## Análise do código

### Código relacionado

| Arquivo/Módulo | Relevância | Notas |
|---|---|---|
| `scripts/assert-tenancy.mjs:9` | Alta | `HUB_REF = 'lrbtbrpoklgwaaclbufz'`; `npm run deploy` **recusa** URL nova |
| `src/lib/tenancy.ts:6` + `src/lib/__tests__/tenancy.test.ts` | Alta | `HUB_SUPABASE_REF` usado em runtime e teste |
| `supabase/config.toml:1` | Alta | `project_id` antigo; `verify_jwt` por função |
| `CLAUDE.md`, `docs/TENANCY.md`, `docs/HUB_ENV.md`, `.env.example` | Média | Ref antigo como canônico (8+7 ocorrências nos docs) |
| `scripts/*.ts` (`apply-antt-res-6084-2026`, `smoke-cte-mdfe-homolog`, `audit-migration-drift.mts`, `clone-cadastro-cargo-to-hub`), `tools/security-audit/config/*.yaml`, `tests/e2e/supabase-mocks.ts` | Média | Ref antigo fixo |
| `supabase/migrations/*cron*` (4 arquivos) | Alta | Cron monta URL via Vault `supabase_url` + `service_role_key` |
| `supabase/migrations/*bucket*`, `20260930150000_*` | Alta | Buckets: `documents`, `cte-documents`, `mdfe-documents`, `dacte-pdfs`, `damdfe-pdfs`, `antt-comprovantes`, coleta, `insurance-exceptions` |
| `supabase/functions/reconcile-trip/index.ts:129` | Média | Único `getPublicUrl` — pode ter gravado URL com ref antigo |
| Funções `next_cte_numero`, `next_mdfe_numero`, `set_quote_code`, `set_os_number`, `generate_trip_number`, `next_collection_order_seq` | Alta | Contadores — não podem reiniciar nem regenerar no restore |
| Triggers `emit_*_event`, `audit_*`, `sync_quote_snapshot_to_orders`, `trg_auto_group_order_to_trip` | Alta | Disparariam eventos/notificações durante restore |

### Padrões a seguir

| Padrão | Exemplo | Aplicar em |
|---|---|---|
| Env de script | `scripts/lib/load-supabase-env.ts` | scripts de inventário/cópia |
| Drift de migrations | `scripts/audit-migration-drift.mts` | conferência de schema |
| Secrets por CLI | `docs/HUB_ENV.md` (`npx supabase secrets set ... --project-ref`) | Task 4 |
| Secrets do sefaz-proxy | `scripts/set-sefaz-supabase-secrets.ps1` | Task 4 |

### Dependências

| A migração depende de | Tipo |
|---|---|
| Senha do banco antigo (`pg_dump`) | Obrigatória |
| Valores originais dos 32 secrets (painel só mostra digest) | Obrigatória |
| Acesso ao painel Focus NFe (URL do webhook) | Obrigatória |
| Acesso Cloudflare Pages `vectrahub` / `vectra-feira` | Obrigatória |

| A migração afeta | Impacto |
|---|---|
| Emissão CT-e/MDF-e (numeração, webhook, averbação) | Alto |
| Login de todos os usuários (sessões caem) | Médio |
| Cron jobs (NTC, notícias, operacionais) | Médio |
| Plano do motor de rota (`docs/superpowers/plans/2026-11-07-motor-rota-pedagio-fase1.md`) | Bloqueado até a virada |

## Entendimento

| Aspecto | Detalhe |
|---|---|
| **O quê** | Mover o Hub de `lrbtbrpoklgwaaclbufz` para `ztyqoufakcxbhabknujd` com schema, dados (`public`, `feira`, `auth`), arquivos, secrets, Vault, functions, cron, front, webhooks e repo |
| **Por quê** | Projeto novo passa a ser o oficial; todo trabalho futuro vai nele |
| **Escopo** | Inclui tudo acima. Exclui Cargo (`epgedaiukjippepujuzc`) e o motor de rota (plano próprio, depois) |

| # | Como... | Quero... | Para... |
|---|---|---|---|
| 1 | operador | entrar no Hub novo com meu usuário e senha | não perder acesso |
| 2 | operador | ver cotações, OS, CT-e e arquivos antigos | continuar o trabalho do dia anterior |
| 3 | fiscal | emitir o próximo CT-e/MDF-e com número seguinte ao último | não ter rejeição por duplicidade nem inutilização |
| 4 | gestor | não disparar notificações a clientes durante a cópia | evitar mensagens falsas |

| # | Critério de aceite | Como verificar |
|---|---|---|
| 1 | Contagem igual por tabela (`public`, `feira`, `auth.users`) | script de contagem nos dois projetos |
| 2 | Contadores ≥ antigo (COT, OS, viagem, coleta, CT-e/MDF-e por ambiente+série) | consulta lado a lado |
| 3 | Objetos por bucket iguais em quantidade e caminho | script de cópia com relatório |
| 4 | Nenhum texto com `lrbtbrpoklgwaaclbufz` nos dados | varredura de colunas texto/jsonb |
| 5 | Login, cotação com cálculo, CT-e em homologação e webhook Focus funcionam no novo | smoke manual + `scripts/smoke-cte-mdfe-homolog.ts` |
| 6 | Nenhuma notificação enviada durante restore | `notification_logs` sem linhas novas no período |

## Plano de implementação

| Fase | # | Tarefa | Size | Arquivos / alvo | Urgency | Risk | ROI | Blast | LOE | Depende de |
|---|---|---|---|---|---|---|---|---|---|---|
| A: Preparação | 1 | Inventário real do antigo: `count(*)` por tabela (`public`, `feira`, `auth.users`), objetos por bucket, `cron.job`, último número CT-e/MDF-e por ambiente+série, valores das sequências; salvar snapshot JSON | M | novo `scripts/migration/inventory.ts`, `scripts/lib/load-supabase-env.ts` (aceitar ref por argumento) | H | L | H | só leitura | 3h | senha do banco antigo |
| A: Preparação | 2 | Conferir schema do novo contra o repo: histórico de migrations (`audit-migration-drift.mts`), `migration repair` das aplicadas fora do CLI, extensões (`pg_net`, `pg_cron`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`), funções e triggers da lista do antigo | M | `scripts/audit-migration-drift.mts`, projeto novo | H | M | H | schema do novo | 3h | — |
| A: Preparação | 3 | Trocar ref no repo (branch própria, sem deploy): guardas de tenancy, `config.toml`, teste | M | `scripts/assert-tenancy.mjs`, `src/lib/tenancy.ts`, `src/lib/__tests__/tenancy.test.ts`, `supabase/config.toml` | H | M | H | deploy do front | 1h | — |
| A: Preparação | 4 | Trocar ref em docs, scripts, e2e e security-audit | M | `CLAUDE.md`, `docs/TENANCY.md`, `docs/HUB_ENV.md`, `.env.example`, `tests/e2e/supabase-mocks.ts`, `tools/security-audit/config/*.yaml`, scripts com ref fixo | M | L | M | docs/ferramentas | 1,5h | 3 |
| B: Configurar novo | 5 | Secrets (32 do antigo + `ORS_API_KEY` já feito) e Vault (`supabase_url`, `service_role_key` do novo); `WEBROUTER_API_URL` etc. Conferir duplicidade `SINTEGRA_API_KEY`/`SINTEGRABRASIL_API_KEY` | M | painel/CLI do novo, `scripts/set-sefaz-supabase-secrets.ps1` | H | M | H | todas as functions | 2h | valores originais |
| B: Configurar novo | 6 | Deploy de todas as Edge Functions no novo + Auth: Site URL, redirect URLs (`app.hub`, `app.feira`), SMTP/templates, providers | M | `supabase/functions/*`, `supabase/config.toml`, painel Auth | H | M | H | todo backend | 2h | 3, 5 |
| C: Ensaio | 7 | Ensaio de dados: dump `--data-only` de `public`, `feira`, `auth` do antigo e restore no novo **com triggers desligados** (`session_replication_role = replica`) e cron pausado; sequências incluídas | M | novo `scripts/migration/restore.ps1`, projeto novo | H | H | H | dados do novo | 3h | 1, 2 |
| C: Ensaio | 8 | Copiar Storage bucket a bucket preservando caminhos; relatório de contagem | M | novo `scripts/migration/copy-storage.ts` | H | M | H | arquivos | 3h | 2 |
| C: Ensaio | 9 | Conferência: contagens vs snapshot, contadores fiscais, varredura de `lrbtbrpoklgwaaclbufz` em colunas texto/jsonb (ex.: URL de `reconcile-trip`) e reescrita, login real, cotação, CT-e homologação | M | novo `scripts/migration/verify.ts`, `scripts/smoke-cte-mdfe-homolog.ts` | H | M | H | validação | 3h | 6, 7, 8 |
| D: Virada | 10 | Dia combinado: congelar emissão e uso no antigo, pausar cron do antigo, limpar e repetir 7+8 com dados finais, rodar 9 | M | antigo + novo | Critical | H | H | operação inteira | 3h | 9 ok |
| D: Virada | 11 | Apontar o mundo para o novo: env do Cloudflare Pages (`vectrahub`, `vectra-feira`) + deploy do front (branch da Task 3), webhook Focus NFe, secrets GitHub Actions, sefaz-proxy, demais callbacks; reativar cron do novo | M | painéis externos, `npm run deploy`, `npm run deploy:feira` | Critical | H | H | operação inteira | 2h | 10 |
| D: Pós-virada | 12 | Monitorar 48h (logs de functions, cron, primeiro CT-e real, `notification_logs`); manter antigo pausado 30 dias; liberar plano do motor de rota | S | painel/logs | M | L | M | observação | 2h | 11 |

**Total estimado:** ~28h · 12 tarefas (11 M, 1 S) · 4 fases.

## Impacto

| Área | Arquivos/alvo | Risco | Notas |
|---|---|---|---|
| Banco (schema) | projeto novo, `supabase/migrations/*` | Médio | Histórico fora de sincronia (3 migrations aplicadas fora do CLI no antigo) |
| Banco (dados) | `public`, `feira`, `auth` | Alto | Triggers e contadores; volume pequeno (~34 COT, 19 OS, 1,4 mil audit_logs) |
| Storage | 8 buckets | Médio | Caminhos preservados; URLs públicas gravadas precisam reescrita |
| Edge Functions | todas | Médio | Deploy + secrets; `verify_jwt` vem do `config.toml` |
| Front | `src/lib/tenancy.ts`, env Pages | Alto | Guarda bloqueia deploy até a Task 3 |
| Externos | Focus NFe, Cloudflare, GitHub, sefaz-proxy | Alto | Webhook Focus errado = CT-e autorizado sem retorno |

## Riscos

| Risco | Prob. | Impacto | Mitigação | Fase |
|---|---|---|---|---|
| CT-e/MDF-e com número repetido no novo | Média | Alto | Restore leva sequências; Task 9 compara último número por ambiente+série; emissão congelada na virada | C, D |
| Triggers disparam no restore (códigos COT/OS regenerados, eventos, notificações a clientes) | Alta sem mitigação | Alto | `session_replication_role = replica` no restore; cron pausado; conferir `notification_logs` | C |
| CT-e autorizado entre dump final e troca do webhook | Baixa | Alto | Congelar emissão antes do dump final (Task 10) | D |
| Secret com valor errado/faltando | Média | Médio | Lista de 32 nomes; smoke por integração na Task 9 | B |
| Sessões caem (JWT secret diferente) | Certa | Baixo | Avisar usuários; senhas seguem no `auth.users` | D |
| URL antiga gravada em dados | Média | Médio | Varredura e reescrita na Task 9 | C |
| `migration repair` errado marca migration não aplicada | Baixa | Alto | Conferir objeto de cada migration no banco antes do repair | A |
| Senha/secret exposta no chat ou repo | Já ocorreu (`sb_secret_`) | Alto | Rotacionar; credenciais só em `.env.local` | A |

## Testes

| Tipo | O quê | Prioridade | Fase |
|---|---|---|---|
| Unit | `tenancy.test.ts` com ref novo; `assert-tenancy` aceita novo e recusa antigo e Cargo | Alta | A |
| Integração | Contagem por tabela e por bucket antigo × novo | Alta | C |
| Integração | Contadores fiscais e de código antigo ≤ novo | Alta | C |
| Integração | `smoke-cte-mdfe-homolog.ts` no novo + retorno do webhook | Alta | C, D |
| Manual | Login de 2 usuários reais (admin e operacional), abrir COT/OS antigas, baixar DACTE | Alta | C, D |
| Manual | Cotação nova com cálculo de km/pedágio (WebRouter atual) | Média | C |

## Rollback

| Fase | Cenário | Ação |
|---|---|---|
| A | Troca de ref quebra build/testes | Não mergear a branch; antigo segue intacto |
| B | Secret/function errada no novo | Corrigir no novo; produção ainda no antigo |
| C | Restore inconsistente | Limpar dados do novo e repetir; antigo intocado |
| D | Falha após virada | Voltar env do Pages para o ref antigo e redeploy; webhook Focus de volta; reativar cron do antigo. Dados criados no novo durante a janela precisam ser reaplicados no antigo manualmente — por isso a janela de virada deve ser curta |

## Pendências do usuário

1. Senha do banco antigo em `.env.local` (Task 1).
2. Valores originais dos secrets (Task 5).
3. Dia e horário da virada, com emissão fiscal congelada (Task 10).
4. Rotacionar a `sb_secret_` exposta.
