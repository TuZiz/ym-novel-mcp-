$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not $env:YM_NOVEL_MCP_HTTP_HOST) {
  $env:YM_NOVEL_MCP_HTTP_HOST = "0.0.0.0"
}

if (-not $env:YM_NOVEL_MCP_HTTP_PORT) {
  $env:YM_NOVEL_MCP_HTTP_PORT = "52778"
}

if (-not $env:YM_NOVEL_MCP_TOKEN) {
  $env:YM_NOVEL_MCP_TOKEN = "tury-186345"
}

if (-not $env:YM_NOVEL_MCP_DB_PATH) {
  $env:YM_NOVEL_MCP_DB_PATH = Join-Path $Root "data\novel.db"
}

Write-Host "[ym-novel-mcp] Windows cloud HTTP startup"
Write-Host "[ym-novel-mcp] Root : $Root"
Write-Host "[ym-novel-mcp] Host : $env:YM_NOVEL_MCP_HTTP_HOST"
Write-Host "[ym-novel-mcp] Port : $env:YM_NOVEL_MCP_HTTP_PORT"
Write-Host "[ym-novel-mcp] DB   : $env:YM_NOVEL_MCP_DB_PATH"
Write-Host "[ym-novel-mcp] Admin local : http://127.0.0.1:$env:YM_NOVEL_MCP_HTTP_PORT/admin"
Write-Host "[ym-novel-mcp] Admin remote: http://SERVER_IP:$env:YM_NOVEL_MCP_HTTP_PORT/admin"

& (Join-Path $Root "start-ym-novel-mcp.cmd")
exit $LASTEXITCODE
