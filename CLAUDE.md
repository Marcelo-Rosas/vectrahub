# Cargo Flow Navigator — Contexto para Agentes AI

## Projeto
TMS (Transport Management System) da VECTRA HUB LTDA, operação em Navegantes e Itajaí, SC.
Sistema web para gestão de cotações de frete, ordens de serviço, precificação, financeiro, documentos de transporte, frota e notificações.

## Stack
Vite + React 18 + TypeScript + Tailwind 3.4 + shadcn/ui + Supabase + React Router 6 + TanStack Query 5
- Dependências e scripts: **npm** + `package-lock.json` — **não usar Bun** (evita `bun.lockb` e quebra de ferramentas que detectam Bun sem ele instalado, ex.: `update-browserslist-db`)

## Comandos
```bash
npm run dev          # Dev server (Vite)
npm run build        # Build produção
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npx tsx scripts/audit-compliance.ts        # Auditoria rápida
npx tsx scripts/audit-periodic.ts          # Auditoria completa
npm run docs:claude                        # Regenera CLAUDE.md UTF-8 (repo principal)
```

## Arquitetura
- SPA com React Router 6 (sem Next.js)
- Server state via TanStack Query 5 (useQuery/useMutation)
- Formulários via React Hook Form + Zod
- Kanban via dnd-kit
- Backend: Supabase (Postgres + Auth + Edge Functions + RLS)
- Deploy: Cloudflare Pages via GitHub Actions

## Convenções críticas
- Moeda em centavos (inteiro): R$ 1.500,00 = 150000 — SEMPRE exibir com 2 casas decimais
- Tipos: importar de `@/integrations/supabase/types.generated` — nunca redefinir
- Auth: usar `useAuth` hook — nunca reimplementar
- WhatsApp: sempre via Edge Function `notification-hub` → OpenClaw — nunca Evolution API direto
- Cálculo de frete: existe em dois lugares (local + Edge Function) — duplicidade intencional
- Edge Functions: chamar via `invokeEdgeFunction` em `src/lib/edgeFunctions.ts`

## Supabase
- Project ref: lrbtbrpoklgwaaclbufz (Vectra HUB)
- Region: sa-east-1
- RLS habilitado em todas as tabelas
- Service Role Key: apenas em Edge Functions

## Edge Functions
Chamar sempre via `invokeEdgeFunction` (`src/lib/edgeFunctions.ts`). Auth: JWT do usuário; internas via `x-internal-token` (`verify_jwt=false` no `supabase/config.toml` quando valida manual).
| Função | Propósito |
|---|---|
| calculate-freight | Cálculo de frete server-side |
| notification-hub | Envio email + WhatsApp via OpenClaw |
| workflow-orchestrator | Eventos de workflow/aprovações |
| generate-optimal-route | Rota otimizada para composição (WebRouter + pedágio) |
| calculate-distance-webrouter | Roteirização simples |
| emit-cte / manage-cte | Emissão/gestão de CT-e (modelo 57) via Focus NFe |
| emit-mdfe / manage-mdfe | Emissão/gestão de MDF-e (modelo 58) via Focus NFe |
| focus-webhook | Webhook de autorização Focus → atualiza `cte_emissions`/`mdfe_emissions`, espelha XML/DACTE, dispara averbação |
| generate-ciot | CIOT via ponte `services/ciot-bridge` (GeradorCIOT ANTT) |
| averba-cte | Averbação de seguro (SOAP AT&M) → grava `averbacoes` |
| ai-manager / ai-orchestrator-agent / ai-operational-orchestrator | Roteador + orquestradores dos workers de IA |

## Módulos principais
- **Comercial**: cotações (draft→pending→approved→rejected→converted), Kanban, wizard 4 passos
- **Operacional**: ordens de serviço, trips, tracking, despacho
- **Financeiro**: faturamento (FAT), pagamento (PAG), parcelas
- **Precificação**: tabelas de preço, cálculo de frete, ANTT, ICMS, peso cubado
- **Composição de carga**: rota no mapa, métricas agregadas (distância, duração, pedágio, paradas)
- **Frota**: motoristas, veículos, proprietários, qualificação
- **Documentos fiscais**: CT-e (57) e MDF-e (58) via Focus NFe (`cte_emissions`/`mdfe_emissions`), CIOT (ANTT), averbação de seguro (AT&M → `averbacoes`), POD, upload
- **Aprovações**: approval_requests + approval_rules
- **IA**: agentes/workers server-side (rentabilidade, anomalia financeira, compliance, qualificação de motorista, insights) — ver "Engenharia de prompt (IA)"

## Hooks de métricas de rota (não confundir)
| Hook | Arquivo | Propósito | Usado por |
|---|---|---|---|
| `useCompositionRouteMetrics` | `src/hooks/useCompositionRouteMetrics.ts` | Métricas de composição: legs, mapa, pedágio centavos | `RouteMapVisualization`, `RouteStats` |
| `useRouteMetrics` | `src/hooks/useRouteMetrics.ts` | Relatórios: RPC `get_route_metrics`, config UF/OS | `Reports.tsx`, `RouteMetricsCards` |

**Regra**: nunca substituir um pelo outro — são domínios diferentes (composição vs relatórios).

## Deploy (CI/CD)
- `.github/workflows/deploy-cloudflare.yml` — detecção inteligente de mudanças
- `.github/workflows/audit-compliance.yml` — auditoria automática + semanal
- Alterou `src/` → build + deploy Cloudflare Pages
- Alterou `supabase/migrations/` → supabase db push
- Alterou `supabase/functions/` → supabase functions deploy (por função)
- Ordem: Migration → Tipos → Build → Deploy

## Debug de pedágio (WebRouter)
- Documentação: `docs/TOLL_DEBUG_CHECKLIST.md` — referências expandidas (composição vs relatórios): `docs/TOLL_DEBUG_CHECKLIST_REFERENCIAS.md` (mesclar no checklist principal quando o arquivo não estiver bloqueado no editor)
- Logs: Supabase → Edge Functions → `generate-optimal-route` e `webrouter-client`
- Strings de busca nos logs: `[generate-optimal-route] WebRouter SUCCESS`, `WebRouter FAILED`, `[webrouter-full] TOLL CALCULATION`

## Averbação de seguro (AT&M / Averba)
Averbação eletrônica do seguro de carga via **AT&M** (portal `www.averba.com.br` + web service SOAP `ATMWebSvr` em `https://webserver.averba.com.br/20/index.soap`). Edge Function `averba-cte` + gatilho no `focus-webhook` gravam em `averbacoes`.

**Pré-requisitos (sem eles nada averba, manual ou API):**
- Apólice de seguro de transporte **vigente** + habilitação do cliente junto à AT&M. O portal alerta na home se não há apólice vigente ou irregularidade cadastral — resolver com corretora/seguradora ANTES.
- Login = `usuario` + `senha` + **CodATM** (caixa postal). Credenciais de integração (`WS`) são obtidas no credenciamento com o suporte AT&M — **não** ficam expostas no portal (senha é write-only; só reset). Suporte: (19) 3885-2000, `sac@atmtec.com.br`, `atm.averbacao@nstech.com.br`.

**Fallback manual (sem credencial SOAP):** portal → aba **Averbação → Novo Documento** (digitação) ou **Importação de arquivos → Enviar XML** (sobe XML do CT-e/NF-e/MDF-e; retorno averbado/recusado em tela; recusados na aba "Documentos Recusados"). Sucesso devolve `Protocolo` + `Número de averbação`.

**Regras de negócio (do manual v6.0):**
- **Ramos**: 21=TN, 32=RCTRC/VI, 38=RCTFC, 52=RCTAC, **54=RCTRC** (obrigatório rodoviário), **55=RCFDC** (facultativo desaparecimento carga), 56=RCAC, 95=RCT-AMB, 96=TR-AMB. Se tem apólices 54 **e** 55 → averbar no **55** (54 já incluso).
- **Resolução CNSP 247/2011 art. 2º**: vedada averbação **simplificada** em seguros RCTR-C → usar averbação completa (o payload SOAP `xmlCTe` completo atende).
- **Tipo de documento**: 1=Manifesto, 2=Conhecimento, 3=Nota Fiscal, 4=Ordem de Carga, 5=Outros. **Tipo de transporte**: 1=Rodoviário…5=Aéreo. **Tipo de movimento**: 1=Normal, 2=Cancelado, 3=Cortesia, 4=Resp. total de terceiro.
- **CNPJ Emissor**: obrigatório só para NF-e e CT-e.
- **Cancelamento** de doc averbado via web service/Importação XML: enviar o **XML de cancelamento protocolado pela SEFAZ** (via Importação XML). Averbar doc cancelado = tipo movimento 2 + valor `0,01`.
- **DDR** (Dispensa Direito de Regresso): informar CNPJ do cliente/DDR na averbação. DDR Total/Estipulação → ramo de maior cobertura, valor `0,01`, tipo mov 4. DDR Parcial → ramo 54, valor total, tipo mov 1.
- **Cód. liberação de limite**: quando valor da mercadoria > limite da apólice (fornecido pela corretora).
- Consistência online: o portal **recusa** averbação em desacordo com a apólice → conferir sempre a aba "Documentos Recusados".

## Engenharia de prompt (IA)
Toda IA roda **server-side em Edge Functions** — nunca chamar LLM do cliente (chaves só em secrets). Skill de autoria/padronização: **vectra-prompt-architect**.

**Provedores (multi, via `supabase/functions/_shared/aiClient.ts`)**: Anthropic (`claude-sonnet-4-20250514`), Google (`gemini-2.5-flash`, `gemini-2.5-pro`), OpenAI (`gpt-4.1-mini`). Roteamento por `ai-manager`. Chaves: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (secrets). Preferir o modelo mais barato que resolve; `pro`/`sonnet` só para raciocínio pesado.

**Onde vivem os prompts** (nunca inline no worker):
- System prompts: `supabase/functions/_shared/prompts/system_*.ts` (um por worker: compliance, quote_profitability, financial_anomaly, driver_qualification, operational_*, approval_summary, dashboard_insights, regulatory, news_summary).
- Schemas de saída estruturada: `supabase/functions/_shared/prompts/schemas.ts`.
- Lógica dos agentes: `supabase/functions/_shared/workers/*Worker.ts`, orquestrados por `ai-orchestrator-agent` / `ai-operational-orchestrator`.

**Regras**:
- **Saída estruturada sempre**: definir JSON schema em `schemas.ts` e parsear com `llm-json-parse.ts` (tolerante a cercas/lixo) — nunca `JSON.parse` cru na resposta do LLM.
- **Segurança contra prompt injection**: passar entrada não-confiável (dados de cotação/OS, texto de usuário, conteúdo raspado) por `aiSecurity.ts` antes de montar o prompt. Tratar dados do banco/consulta como **não-confiáveis** (delimitar, nunca como instrução).
- **Idioma**: prompts e saídas em Português BR.
- **Determinismo**: temperatura baixa para tarefas de extração/classificação/compliance; deixar o schema restringir o formato.
- **Custo/observabilidade**: uso registrado em `ai_usage_tracking`; orçamento em `ai_budget_config`. Não criar loops de chamada sem teto.
- **Versionar prompt junto do worker**: mudou o comportamento → editar o `system_*.ts` correspondente (não hardcodar no worker) e revisar o schema.
- Ao criar prompt novo: usar a skill **vectra-prompt-architect** para padronizar tom/estrutura antes de commitar.

## Não fazer
- Não usar Bun como runtime ou gerenciador de pacotes (`bun install`, commitar `bun.lockb`) — stack é **npm**; ver também `bun.lockb` no `.gitignore`
- Não usar Zustand, Redux, MobX
- Não usar Next.js patterns
- Não hardcodar alíquotas de ICMS
- Não fazer deploy manual
- Não chamar Evolution API diretamente
- Não reimplementar auth
- Não exibir valores sem R$ e 2 casas decimais
- Não sobrescrever `useRouteMetrics` para métricas de composição — usar `useCompositionRouteMetrics`
- Não chamar LLM do cliente nem hardcodar prompt no worker — prompts em `_shared/prompts/`, IA só server-side
- Não `JSON.parse` cru em resposta de LLM — usar `llm-json-parse.ts` + schema
