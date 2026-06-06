@echo off
setlocal
cd /d "%~dp0\.."

echo [ym-novel-mcp] HTTP startup check
echo [ym-novel-mcp] Repo: %CD%
echo [ym-novel-mcp] Preparing Streamable HTTP MCP...

set "PNPM_CMD=pnpm.cmd"
where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  if exist "%APPDATA%\npm\pnpm.cmd" (
    set "PNPM_CMD=%APPDATA%\npm\pnpm.cmd"
  ) else (
    where corepack.cmd >nul 2>nul
    if errorlevel 1 (
      >&2 echo [ym-novel-mcp] pnpm.cmd was not found in PATH, and corepack.cmd is unavailable.
      >&2 echo [ym-novel-mcp] Install pnpm or Node.js with Corepack, then retry.
      exit /b 1
    )
    set "PNPM_CMD=corepack.cmd pnpm"
  )
)

echo [ym-novel-mcp] Package manager: %PNPM_CMD%

set "PNPM_INSTALL_ARGS=install --frozen-lockfile --prefer-offline --fetch-retries 5 --fetch-retry-mintimeout 10000 --fetch-retry-maxtimeout 120000"

set "NODE_CMD=node"
if exist "runtime\node.exe" (
  set "NODE_CMD=%CD%\runtime\node.exe"
)

if "%NODE_CMD%"=="node" (
  where node >nul 2>nul
  if errorlevel 1 (
    >&2 echo [ym-novel-mcp] node was not found in PATH.
    exit /b 1
  )
)

echo [ym-novel-mcp] Node: %NODE_CMD%

if exist "dist\httpIndex.js" if exist "node_modules" (
  echo [ym-novel-mcp] Found bundled dist and node_modules. Skipping install/build.
  goto start_http_server
)

if not exist "node_modules" (
  >&2 echo [ym-novel-mcp] Installing dependencies...
  call :install_dependencies
  if errorlevel 1 exit /b 1
)

if not exist "node_modules\.bin\tsc.cmd" (
  >&2 echo [ym-novel-mcp] TypeScript compiler was not found. Reinstalling dependencies...
  call :install_dependencies
  if errorlevel 1 exit /b 1
)

call %PNPM_CMD% build >nul
if errorlevel 1 (
  >&2 echo [ym-novel-mcp] Build failed.
  exit /b 1
)

if not exist "dist\httpIndex.js" (
  >&2 echo [ym-novel-mcp] Missing dist\httpIndex.js after build.
  exit /b 1
)

echo [ym-novel-mcp] Build OK. Starting server now...

:start_http_server
"%NODE_CMD%" "dist\httpIndex.js"
exit /b %errorlevel%

:install_dependencies
if defined YM_NOVEL_MCP_NPM_REGISTRY (
  >&2 echo [ym-novel-mcp] Using registry: %YM_NOVEL_MCP_NPM_REGISTRY%
  call %PNPM_CMD% %PNPM_INSTALL_ARGS% --registry=%YM_NOVEL_MCP_NPM_REGISTRY%
  exit /b %errorlevel%
)

call %PNPM_CMD% %PNPM_INSTALL_ARGS%
if not errorlevel 1 exit /b 0

>&2 echo [ym-novel-mcp] Dependency install failed from the default registry.
>&2 echo [ym-novel-mcp] Retrying with https://registry.npmmirror.com ...
call %PNPM_CMD% %PNPM_INSTALL_ARGS% --registry=https://registry.npmmirror.com
if not errorlevel 1 exit /b 0

>&2 echo [ym-novel-mcp] Dependency install failed after retry.
>&2 echo [ym-novel-mcp] Set YM_NOVEL_MCP_NPM_REGISTRY to a reachable npm mirror, then start again.
exit /b 1
