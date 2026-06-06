$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Copy-ReleaseDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Source,
    [Parameter(Mandatory = $true)]
    [string] $DestinationParent
  )

  $Name = Split-Path -Leaf $Source
  $Destination = Join-Path $DestinationParent $Name
  New-Item -ItemType Directory -Force $Destination | Out-Null

  robocopy $Source $Destination /E /NP /NFL /NDL /NJH /NJS | Out-Host
  $Code = $LASTEXITCODE
  if ($Code -gt 7) {
    throw "robocopy failed for $Name with exit code $Code."
  }
  $global:LASTEXITCODE = 0
}

function Copy-PackageToTopLevelNodeModules {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Source,
    [Parameter(Mandatory = $true)]
    [string] $PackageName,
    [Parameter(Mandatory = $true)]
    [string] $TopLevelNodeModules
  )

  $Destination = Join-Path $TopLevelNodeModules $PackageName
  New-Item -ItemType Directory -Force (Split-Path -Parent $Destination) | Out-Null
  Copy-ReleaseDirectory -Source $Source -DestinationParent (Split-Path -Parent $Destination)
}

function Flatten-PnpmPackages {
  param(
    [Parameter(Mandatory = $true)]
    [string] $TopLevelNodeModules
  )

  $PnpmDir = Join-Path $TopLevelNodeModules ".pnpm"
  if (-not (Test-Path $PnpmDir)) {
    return
  }

  Write-Host "[ym-novel-mcp] Flattening pnpm packages for portable Windows runtime..."
  $Entries = Get-ChildItem -LiteralPath $PnpmDir -Directory
  foreach ($Entry in $Entries) {
    $NestedNodeModules = Join-Path $Entry.FullName "node_modules"
    if (-not (Test-Path $NestedNodeModules)) {
      continue
    }

    foreach ($Child in Get-ChildItem -LiteralPath $NestedNodeModules -Directory) {
      if ($Child.Name.StartsWith("@")) {
        foreach ($ScopedPackage in Get-ChildItem -LiteralPath $Child.FullName -Directory) {
          Copy-PackageToTopLevelNodeModules `
            -Source $ScopedPackage.FullName `
            -PackageName (Join-Path $Child.Name $ScopedPackage.Name) `
            -TopLevelNodeModules $TopLevelNodeModules
        }
      } else {
        Copy-PackageToTopLevelNodeModules `
          -Source $Child.FullName `
          -PackageName $Child.Name `
          -TopLevelNodeModules $TopLevelNodeModules
      }
    }
  }
}

$Pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $Pnpm) {
  $Pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
}

if (-not $Pnpm) {
  throw "pnpm was not found. Install pnpm or enable Corepack, then retry."
}

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  throw "node_modules was not found. Run pnpm install once on the packaging machine, then retry."
}

Write-Host "[ym-novel-mcp] Building dist before packaging..."
& $Pnpm.Source build
if ($LASTEXITCODE -ne 0) {
  throw "pnpm build failed."
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReleaseRoot = Join-Path $Root "release"
$PackageName = "ym-novel-mcp-windows-cloud-with-deps-$Timestamp"
$PackageDir = Join-Path $ReleaseRoot $PackageName
$ZipPath = Join-Path $ReleaseRoot "$PackageName.zip"

New-Item -ItemType Directory -Force $ReleaseRoot | Out-Null
if (Test-Path $PackageDir) {
  throw "Package directory already exists: $PackageDir"
}

New-Item -ItemType Directory -Force $PackageDir | Out-Null

$Dirs = @(
  "bin",
  "codex",
  "dist",
  "scripts",
  "skills"
)

foreach ($Dir in $Dirs) {
  $Source = Join-Path $Root $Dir
  if (Test-Path $Source) {
    Write-Host "[ym-novel-mcp] Copying $Dir ..."
    Copy-ReleaseDirectory -Source $Source -DestinationParent $PackageDir
  }
}

$Files = @(
  ".env.example",
  ".mcp.json",
  "AGENTS.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "README.md",
  "start-ym-novel-mcp.cmd",
  "windows_cloud_http_api.ps1"
)

foreach ($File in $Files) {
  $Source = Join-Path $Root $File
  if (Test-Path $Source) {
    Copy-Item -LiteralPath $Source -Destination $PackageDir -Force
  }
}

New-Item -ItemType Directory -Force (Join-Path $PackageDir "data") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $PackageDir "logs") | Out-Null

$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
  $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
}

if (-not $NodeCommand) {
  throw "node was not found. Install Node.js on the packaging machine, then retry."
}

$RuntimeDir = Join-Path $PackageDir "runtime"
New-Item -ItemType Directory -Force $RuntimeDir | Out-Null
Copy-Item -LiteralPath $NodeCommand.Source -Destination (Join-Path $RuntimeDir "node.exe") -Force

$NodeVersion = & $NodeCommand.Source -v
$NodeModuleVersion = & $NodeCommand.Source -e "console.log(process.versions.modules)"
Set-Content -LiteralPath (Join-Path $RuntimeDir "node-version.txt") -Encoding ASCII -Value @(
  "node=$NodeVersion",
  "node_module_version=$NodeModuleVersion",
  "source=$($NodeCommand.Source)"
)
Write-Host "[ym-novel-mcp] Bundled Node runtime: $NodeVersion (NODE_MODULE_VERSION $NodeModuleVersion)"

Write-Host "[ym-novel-mcp] Installing production dependencies into package..."
Push-Location $PackageDir
try {
  $InstallArgs = @(
    "install",
    "--prod",
    "--frozen-lockfile",
    "--prefer-offline",
    "--fetch-retries",
    "5",
    "--fetch-retry-mintimeout",
    "10000",
    "--fetch-retry-maxtimeout",
    "120000"
  )

  if ($env:YM_NOVEL_MCP_RELEASE_OFFLINE -eq "1") {
    $InstallArgs += "--offline"
  }

  & $Pnpm.Source @InstallArgs
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm production install failed."
  }
  $ProductionDepsReady = $true
} catch {
  $ProductionDepsReady = $false
  Write-Warning "[ym-novel-mcp] Production dependency install failed. Falling back to the existing node_modules directory."
} finally {
  Pop-Location
}

if (-not $ProductionDepsReady) {
  $PackagedNodeModules = Join-Path $PackageDir "node_modules"
  if (Test-Path $PackagedNodeModules) {
    Remove-Item -LiteralPath $PackagedNodeModules -Recurse -Force
  }

  Copy-ReleaseDirectory -Source (Join-Path $Root "node_modules") -DestinationParent $PackageDir

  Write-Host "[ym-novel-mcp] Pruning fallback node_modules to production dependencies..."
  Push-Location $PackageDir
  try {
    & $Pnpm.Source prune --prod --config.confirm-modules-purge=false
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm prune --prod failed."
    }
  } catch {
    Write-Warning "[ym-novel-mcp] Production prune failed. The package will keep the full node_modules fallback."
  } finally {
    Pop-Location
  }
}

Flatten-PnpmPackages -TopLevelNodeModules (Join-Path $PackageDir "node_modules")

Write-Host "[ym-novel-mcp] Creating zip: $ZipPath"
if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

try {
  Compress-Archive -LiteralPath $PackageDir -DestinationPath $ZipPath -Force
} catch {
  Write-Warning "[ym-novel-mcp] Compress-Archive failed. Retrying with tar.exe."
  if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  tar.exe -a -cf $ZipPath -C $ReleaseRoot $PackageName
  if ($LASTEXITCODE -ne 0) {
    throw "tar.exe failed to create the release zip."
  }
}

Write-Host "[ym-novel-mcp] Release package ready:"
Write-Host "  Directory: $PackageDir"
Write-Host "  Zip      : $ZipPath"
Write-Host "  Start    : C:\Windows\System32\cmd.exe /d /c `"$PackageDir\start-ym-novel-mcp.cmd`""
