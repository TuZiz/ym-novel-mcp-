@echo off
setlocal
title ym-novel-mcp
cd /d "%~dp0"

echo [1/4] Checking runtime...
where pnpm.cmd >nul 2>nul
if errorlevel 1 goto :missing_pnpm

where node >nul 2>nul
if errorlevel 1 goto :missing_node

if not exist "node_modules" (
  echo [2/4] Installing dependencies...
  call pnpm.cmd install
  if errorlevel 1 goto :failed
) else (
  echo [2/4] Dependencies already installed.
)

echo [3/4] Building ym-novel-mcp...
call pnpm.cmd build
if errorlevel 1 goto :failed

echo [4/4] Starting ym-novel-mcp on stdio...
echo Keep this window open while a client is connected.
echo.
call node "dist\src\index.js"
set "EXIT_CODE=%errorlevel%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo ym-novel-mcp exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%

:missing_pnpm
echo pnpm.cmd was not found in PATH.
echo Install Node.js and pnpm first, then retry.
pause
exit /b 1

:missing_node
echo node was not found in PATH.
echo Install Node.js first, then retry.
pause
exit /b 1

:failed
echo.
echo Startup failed.
pause
exit /b 1
