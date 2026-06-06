# Client Setup

Use this reference only when the MCP server is not visible or fails to start.

## Server Expectations

- Primary Windows launcher for cloud/web HTTP: `start-ym-novel-mcp.cmd`
- Internal compatibility command for Windows stdio: `bin/ym-novel-mcp-stdio.cmd`
- Direct HTTP command after build: `node dist/httpIndex.js`
- Direct stdio command after build: `node dist/index.js`
- Required environment variable: `YM_NOVEL_MCP_DB_PATH`
- The server is cloud-friendly and does not require OpenAI, Claude, or web API keys.

## Codex Project Config Shape

HTTP mode is the recommended production shape. Use the MCP client's Streamable HTTP transport and point it at:

```text
http://SERVER_IP:52778/mcp
```

Send the configured token:

```text
Authorization: Bearer <token>
```

STDIO is kept only for local compatibility with clients that do not support Streamable HTTP yet.

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

## Cloud HTTP Shape

Use HTTP mode when one cloud host owns the SQLite database and other machines connect by IP or domain.

Server environment:

```env
YM_NOVEL_MCP_DB_PATH=/data/novel.db
YM_NOVEL_MCP_HTTP_HOST=0.0.0.0
YM_NOVEL_MCP_HTTP_PORT=52778
YM_NOVEL_MCP_TOKEN=change-this-token
```

Start command:

```bash
pnpm build
pnpm start
```

Windows launcher:

```bat
start-ym-novel-mcp.cmd
```

Endpoint:

```text
http://SERVER_IP:52778/mcp
```

Clients should send:

```text
Authorization: Bearer <token>
```

Keep `novel.db` on a persistent disk. Do not put it in a temporary container filesystem, and do not let multiple machines write the SQLite file directly over a shared folder.

When startup succeeds, the server prints `HTTP MCP server is READY` together with the endpoint, health URL, database path, and auth status.
It also prints an admin URL:

```text
http://SERVER_IP:52778/admin
```

The web admin page reuses `YM_NOVEL_MCP_TOKEN` for JSON APIs. It is a read-only monitor for service status, database size, table counts, projects, cross-table search, and project snapshots. Write operations still go through MCP tools.

## Validation

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

If the client still cannot see tools, restart the client after changing MCP config.
