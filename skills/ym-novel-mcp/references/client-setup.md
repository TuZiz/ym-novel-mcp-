# Client Setup

Use this reference only when the MCP server is not visible or fails to start.

## Local Server Expectations

- Repository command for Windows stdio: `start-ym-novel-mcp.cmd`
- Direct command after build: `node dist/index.js`
- Required environment variable: `YM_NOVEL_MCP_DB_PATH`
- The server is local-first and does not require OpenAI, Claude, or web API keys.

## Codex Project Config Shape

Use the project-local config as the source pattern:

```toml
[mcp_servers.ym-novel-mcp]
type = "stdio"
command = "cmd"
args = ["/d", "/c", "ABSOLUTE_REPO_PATH/bin/ym-novel-mcp-stdio.cmd"]
startup_timeout_sec = 120

[mcp_servers.ym-novel-mcp.env]
YM_NOVEL_MCP_DB_PATH = "ABSOLUTE_REPO_PATH/data/novel.db"
```

## Claude Code Shape

Use the same stdio command and environment values in Claude Code's MCP server configuration. Prefer an absolute repository path on Windows.

## Validation

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

If the client still cannot see tools, restart the client after changing MCP config.
