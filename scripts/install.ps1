# Instala ou reinstala o Conexão Flow no Windows.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -Uninstall
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -NoBuild

param(
    [switch]$Uninstall,
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$RepoDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoDir

$AppName = "Conexão Flow"
$ProductDir = Join-Path $env:LOCALAPPDATA "Programs\network-connection"
$SupportDir = Join-Path $env:APPDATA "network-connection"

function Log($msg)  { Write-Host "[install] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[erro] $msg" -ForegroundColor Red }

function Invoke-Uninstall {
    $uninstaller = Join-Path $ProductDir "Uninstall $AppName.exe"
    if (Test-Path $uninstaller) {
        Log "Executando uninstaller em $uninstaller"
        Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait
    } elseif (Test-Path $ProductDir) {
        Log "Removendo diretorio $ProductDir"
        Remove-Item -Recurse -Force $ProductDir
    } else {
        Warn "Nenhuma instalacao encontrada em $ProductDir"
    }
    if (Test-Path $SupportDir) {
        Log "Limpando dados em $SupportDir"
        Remove-Item -Recurse -Force $SupportDir
    }
}

if ($Uninstall) {
    Invoke-Uninstall
    Log "Desinstalacao concluida."
    exit 0
}

# ---- Package manager ----
$pm = $null
if (Get-Command pnpm -ErrorAction SilentlyContinue) { $pm = "pnpm" }
elseif (Get-Command npm -ErrorAction SilentlyContinue) { $pm = "npm" }
else {
    Err "pnpm ou npm necessarios. Instale Node.js 18+ (https://nodejs.org)."
    exit 1
}
Log "Usando package manager: $pm"

# ---- Node ----
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Err "Node.js nao encontrado."
    exit 1
}
$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 18) {
    Err "Node 18+ necessario (encontrado $(node -v))."
    exit 1
}

# ---- Remover instalacao anterior ----
Invoke-Uninstall

# ---- Instalar deps ----
Log "Instalando dependencias ($pm install)"
& $pm install
if ($LASTEXITCODE -ne 0) { throw "$pm install falhou" }

# ---- Build ----
if (-not $NoBuild) {
    Log "Rodando electron-builder (dist:win)"
    & $pm run dist:win
    if ($LASTEXITCODE -ne 0) { throw "build falhou" }
} else {
    Log "Pulando build (-NoBuild)"
}

# ---- Instalar artefato ----
$installer = Get-ChildItem -Path "dist" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $installer) {
    $installer = Get-ChildItem -Path "dist" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not $installer) {
    Err "Nenhum instalador encontrado em dist/."
    exit 1
}

Log "Executando instalador silencioso: $($installer.FullName)"
Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait

$mainExe = Join-Path $ProductDir "$AppName.exe"
if (Test-Path $mainExe) {
    Log "App instalado em $mainExe"
    Start-Process -FilePath $mainExe
} else {
    Warn "Nao foi possivel localizar $mainExe apos instalacao."
}
Log "Concluido."
