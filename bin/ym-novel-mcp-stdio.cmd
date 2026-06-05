@echo off
setlocal
cd /d "%~dp0\.."

where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  >&2 echo [ym-novel-mcp] pnpm.cmd was not found in PATH.
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  >&2 echo [ym-novel-mcp] node was not found in PATH.
  exit /b 1
)

if not exist "node_modules" (
  >&2 echo [ym-novel-mcp] Installing dependencies...
  call pnpm.cmd install --frozen-lockfile
  if errorlevel 1 exit /b 1
)

call pnpm.cmd build >nul
if errorlevel 1 (
  >&2 echo [ym-novel-mcp] Build failed.
  exit /b 1
)

if not exist "dist\index.js" (
  >&2 echo [ym-novel-mcp] Missing dist\index.js after build.
  exit /b 1
)

node "dist\index.js"
exit /b %errorlevel%
