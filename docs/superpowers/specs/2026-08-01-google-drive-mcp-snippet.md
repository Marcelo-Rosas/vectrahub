# MCP — trecho Google Drive (adicionar ao seu mcp.json)

**Não** versionar tokens. O access token Supabase que você colou no chat deve ser **rotado** no Dashboard.

## 1) Auth Google Drive (uma vez)

```bash
npx -y @piotr-agier/google-drive-mcp auth
```

## 2) Bloco para colar em `mcpServers`

```json
"google-drive": {
  "command": "npx",
  "args": ["-y", "@piotr-agier/google-drive-mcp"]
}
```

Opcional (credencial OAuth explícita):

```json
"google-drive": {
  "command": "npx",
  "args": ["-y", "@piotr-agier/google-drive-mcp"],
  "env": {
    "GOOGLE_DRIVE_OAUTH_CREDENTIALS": "C:/Users/marce/.config/google-drive-mcp/credentials.json"
  }
}
```

## 3) Planilha RVL alvo

- ID: `1W8NL2PuX_OmeHKyEyylOi8h5GY9S2e4f`
- gid: `533972825`
- URL: https://docs.google.com/spreadsheets/d/1W8NL2PuX_OmeHKyEyylOi8h5GY9S2e4f/edit?gid=533972825#gid=533972825

## 4) Prompt da sessão

Usar: `docs/superpowers/specs/2026-08-01-tms-fracionado-modeling-prompt.md`
