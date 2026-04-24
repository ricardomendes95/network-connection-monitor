#!/usr/bin/env bash
# Instala ou reinstala o Conexão Flow nesta maquina.
#
# Uso:
#   ./scripts/install.sh              # instala/reinstala (padrao)
#   ./scripts/install.sh --uninstall  # apenas remove o app instalado
#   ./scripts/install.sh --no-build   # pula o build e usa dist/ existente
#
# Requisitos: Node 18+, pnpm ou npm. Em macOS instala em /Applications.
# Em Linux gera AppImage/.deb em ./dist. Em Windows, use scripts/install.ps1.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

MODE="install"
DO_BUILD=1

for arg in "$@"; do
  case "$arg" in
    --uninstall) MODE="uninstall" ;;
    --no-build) DO_BUILD=0 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Opcao desconhecida: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\033[1;34m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; }

PLATFORM="$(uname -s)"
APP_NAME="Conexão Flow"
APP_ID="com.ricardo.network-connection"

uninstall_macos() {
  local target="/Applications/${APP_NAME}.app"
  if [ -d "$target" ]; then
    log "Removendo ${target}"
    rm -rf "$target"
  else
    warn "Nenhum app instalado em ${target}"
  fi
  # Limpa caches do app para forcar primeira execucao limpa
  local support="$HOME/Library/Application Support/network-connection"
  if [ -d "$support" ]; then
    log "Limpando dados em ${support}"
    rm -rf "$support"
  fi
}

uninstall_linux() {
  log "Em Linux remova manualmente o AppImage/.deb instalado."
  local support="$HOME/.config/network-connection"
  if [ -d "$support" ]; then
    log "Limpando dados em ${support}"
    rm -rf "$support"
  fi
}

if [ "$MODE" = "uninstall" ]; then
  case "$PLATFORM" in
    Darwin) uninstall_macos ;;
    Linux)  uninstall_linux ;;
    *) err "Plataforma nao suportada: $PLATFORM"; exit 1 ;;
  esac
  log "Desinstalacao concluida."
  exit 0
fi

# ---- Resolver package manager ----
if command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
else
  err "pnpm ou npm sao necessarios. Instale Node.js 18+ (https://nodejs.org)."
  exit 1
fi
log "Usando package manager: $PM"

# ---- Checar Node ----
if ! command -v node >/dev/null 2>&1; then
  err "Node.js nao encontrado."
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node 18+ necessario (encontrado $(node -v))."
  exit 1
fi

# ---- Desinstala versao anterior antes de reinstalar (macOS) ----
if [ "$PLATFORM" = "Darwin" ]; then
  existing="/Applications/${APP_NAME}.app"
  if [ -d "$existing" ]; then
    log "Removendo instalacao anterior em ${existing}"
    rm -rf "$existing"
  fi
fi

# ---- Instalar dependencias ----
log "Instalando dependencias (${PM} install)"
if [ "$PM" = "pnpm" ]; then
  pnpm install
else
  npm install
fi

# ---- Build ----
if [ "$DO_BUILD" -eq 1 ]; then
  log "Rodando electron-builder"
  if [ "$PM" = "pnpm" ]; then
    pnpm run dist
  else
    npm run dist
  fi
else
  log "Pulando build (--no-build)"
fi

# ---- Instalar artefatos ----
case "$PLATFORM" in
  Darwin)
    # electron-builder produz dist/mac-arm64/<APP_NAME>.app ou dist/mac/<APP_NAME>.app
    CANDIDATE=""
    for dir in "dist/mac-arm64" "dist/mac" "dist/mac-universal" "dist/mac-x64"; do
      if [ -d "$dir/${APP_NAME}.app" ]; then
        CANDIDATE="$dir/${APP_NAME}.app"
        break
      fi
    done
    if [ -z "$CANDIDATE" ]; then
      err "Nao encontrei ${APP_NAME}.app em dist/. Verifique o build."
      exit 1
    fi
    log "Copiando ${CANDIDATE} -> /Applications/"
    rm -rf "/Applications/${APP_NAME}.app"
    cp -R "$CANDIDATE" "/Applications/"
    INSTALLED="/Applications/${APP_NAME}.app"
    # Remove todos os atributos estendidos (quarantine, provenance, etc).
    # O macOS 14+ usa `com.apple.provenance` que invalida a assinatura ad-hoc.
    xattr -cr "$INSTALLED" 2>/dev/null || true
    # Re-assinar ad-hoc profundamente. Sem isso o bundle copiado fica com a
    # assinatura linker-signed original do Electron que nao cobre os recursos
    # do projeto — no macOS 14+ o hardened runtime mata o processo na
    # inicializacao do V8 (SIGTRAP / brk 0).
    log "Re-assinando ad-hoc o bundle"
    if ! codesign --force --deep --sign - "$INSTALLED" 2>&1 | tail -3; then
      warn "Falha no re-sign ad-hoc — o app pode nao abrir em macOS recente"
    fi
    log "App instalado em ${INSTALLED}"
    log "Abrindo o app..."
    open "$INSTALLED" || true
    ;;
  Linux)
    log "Artefatos disponiveis em dist/:"
    ls -1 dist/ | grep -E '\.(AppImage|deb)$' || warn "Nenhum artefato Linux encontrado."
    log "Para AppImage: chmod +x dist/*.AppImage && ./dist/*.AppImage"
    log "Para .deb: sudo dpkg -i dist/*.deb"
    ;;
  *)
    err "Plataforma nao suportada automaticamente: $PLATFORM"
    exit 1
    ;;
esac

log "Concluido. App id: ${APP_ID}"
