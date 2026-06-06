@echo off
setlocal

rem Main Windows cloud launcher for ym-novel-mcp.
rem Override these env vars before starting if your cloud disk, port, or token changes.

if not defined YM_NOVEL_MCP_HTTP_HOST set "YM_NOVEL_MCP_HTTP_HOST=0.0.0.0"
if not defined YM_NOVEL_MCP_HTTP_PORT set "YM_NOVEL_MCP_HTTP_PORT=52778"
if not defined YM_NOVEL_MCP_TOKEN set "YM_NOVEL_MCP_TOKEN=tury-186345"
if not defined YM_NOVEL_MCP_DB_PATH set "YM_NOVEL_MCP_DB_PATH=%~dp0data\novel.db"

echo [ym-novel-mcp] Windows cloud mode
echo [ym-novel-mcp] Host: %YM_NOVEL_MCP_HTTP_HOST%
echo [ym-novel-mcp] Port: %YM_NOVEL_MCP_HTTP_PORT%
echo [ym-novel-mcp] DB  : %YM_NOVEL_MCP_DB_PATH%
echo [ym-novel-mcp] Admin URL on server: http://127.0.0.1:%YM_NOVEL_MCP_HTTP_PORT%/admin
echo [ym-novel-mcp] Remote Admin URL  : http://SERVER_IP:%YM_NOVEL_MCP_HTTP_PORT%/admin

call "%~dp0bin\ym-novel-mcp-http.cmd"
exit /b %errorlevel%
