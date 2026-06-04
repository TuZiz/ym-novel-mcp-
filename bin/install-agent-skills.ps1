param(
  [string]$CodexHome = "$HOME\.codex",
  [string]$ClaudeHome = "$HOME\.claude"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$codexSource = Join-Path $repoRoot "codex\skills\ym-novel-mcp"
$claudeSource = Join-Path $repoRoot ".claude\skills\ym-novel-mcp"

$codexTarget = Join-Path $CodexHome "skills\ym-novel-mcp"
$claudeTarget = Join-Path $ClaudeHome "skills\ym-novel-mcp"

foreach ($pair in @(
  @{ Source = $codexSource; Target = $codexTarget; Label = "Codex" },
  @{ Source = $claudeSource; Target = $claudeTarget; Label = "Claude Code" }
)) {
  if (-not (Test-Path $pair.Source)) {
    throw "Missing source skill: $($pair.Source)"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $pair.Target) | Out-Null
  if (Test-Path $pair.Target) {
    Remove-Item -LiteralPath $pair.Target -Recurse -Force
  }

  Copy-Item -LiteralPath $pair.Source -Destination $pair.Target -Recurse -Force
  Write-Output ("Installed " + $pair.Label + " skill to " + $pair.Target)
}
