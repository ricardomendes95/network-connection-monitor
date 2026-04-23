# Network Monitor

Aplicativo desktop em Electron + React para monitorar velocidade de internet, armazenar histórico em SQLite e alertar em transições de conectividade (online/offline). Funciona como menu bar app — o teste roda silenciosamente em segundo plano.

## Destaques

- **Menu bar / tray** em todas as plataformas: status atual (online/offline/testando), download, upload, ping, última verificação e botão "Testar agora".
- **Testes silenciosos**: os speed tests rodam em background sem roubar foco da tela.
- **Alertas inteligentes**: notificação dispara apenas em transições `online → offline` ("Sem internet") e `offline → online` ("Internet voltou"). Nada de spam a cada teste.
- **Intervalos configuráveis** de 1 minuto até 4 horas.
- **Ookla Speedtest CLI oficial** — roda nativo em Apple Silicon, x64, ARM e Windows.
- **Autostart** com o sistema (macOS, Windows, Linux).
- **Histórico em SQLite** com gráficos por hora, dia da semana, timeline e detecção de instabilidade.

## Stack

- Electron 32 + electron-vite
- React 18 + TypeScript + Tailwind CSS
- Recharts
- SQLite via `better-sqlite3`
- [Ookla Speedtest CLI](https://www.speedtest.net/apps/cli) (baixado sob demanda e cacheado em `userData/speedtest-cli/`)

## Requisitos

### macOS
- Node.js 18+ (20 LTS recomendado)
- `pnpm` ou `npm`

### Linux
- Node.js 18+ (20 LTS recomendado)
- `pnpm` ou `npm`
- `build-essential`, Python 3 (para `better-sqlite3`)

### Windows
- Node.js 18+ (20 LTS recomendado)
- `pnpm` ou `npm`
- Python 3.11 + Visual Studio 2022 Build Tools com C++ (para compilar `better-sqlite3` e `lzma-native`)

## Instalação e execução

### Scripts de (re)instalação

A forma mais rápida de instalar o app na sua máquina:

```bash
# macOS / Linux
pnpm app:install          # instala (ou reinstala) — build + copia para /Applications
pnpm app:install:no-build # pula o build e usa dist/ existente
pnpm app:uninstall        # remove o app e dados de suporte
```

```powershell
# Windows
pnpm app:install:win
pnpm app:uninstall:win
```

Os scripts estão em `scripts/install.sh` e `scripts/install.ps1`.

### Desenvolvimento

```bash
pnpm install
pnpm dev
```

### Build manual

```bash
pnpm build           # apenas compila o bundle
pnpm dist            # macOS / Linux — gera o instalador em dist/
pnpm dist:win        # Windows — gera o instalador NSIS + portable em dist/
```

> ⚠️ O build Windows deve ser feito em uma máquina Windows. Um `predist:win` bloqueia a execução em host Linux porque os módulos nativos compilados lá ficam inválidos.

## Setup detalhado por plataforma

### macOS

```bash
# Instala Node via nvm, se ainda não tiver
nvm install 20 && nvm use 20

# Clona o projeto, entra no diretório e instala tudo
pnpm install

# Build + instalação em /Applications em um comando
pnpm app:install
```

O app aparece na menu bar (parte superior direita da tela). Para abrir a janela principal, clique no ícone e depois em "Abrir janela principal".

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y build-essential python3 make g++

nvm install 20 && nvm use 20
pnpm install
pnpm dist
```

Artefatos (`AppImage`, `.deb`) são gerados em `dist/`.

### Windows

Recomendação: clone o projeto em um caminho nativo (ex: `C:\dev\network-connection-monitor`), não dentro do WSL.

**1. Node.js 20 via nvm-windows**

```powershell
nvm install 20.18.0
nvm use 20.18.0
```

**2. Python 3.11**

```powershell
winget install -e --id Python.Python.3.11
```

Feche e reabra o PowerShell. Se necessário, configure o `node-gyp`:

```powershell
setx PYTHON "C:\Users\<SEU_USUARIO>\AppData\Local\Programs\Python\Python311\python.exe"
setx npm_config_python "C:\Users\<SEU_USUARIO>\AppData\Local\Programs\Python\Python311\python.exe"
```

**3. Visual Studio 2022 Build Tools**

```powershell
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Inclua os componentes: *Desktop development with C++*, *MSVC v143*, *Windows 10/11 SDK*.

**4. Instalar e buildar**

```powershell
cd C:\dev\network-connection-monitor
pnpm install
pnpm approve-builds   # aprove: better-sqlite3, electron, esbuild, lzma-native
pnpm app:install:win
```

## Uso

### Menu bar / Tray

O ícone na barra de menu (macOS) ou na system tray (Windows/Linux) mostra:

- **Status**: ● online / ● offline / ⟳ testando…
- **Velocidade atual** (no macOS, aparece no próprio título)
- **Última verificação** no menu
- **Testar agora** — dispara um teste imediatamente
- **Abrir janela principal** — recria a janela se ela foi fechada
- **Sair** — encerra o app

Fechar a janela principal **não** fecha o app. Ele continua rodando em segundo plano monitorando sua conexão.

### Configurações

Disponíveis na página *Configurações* da janela principal:

- **Plano contratado** (de 50 Mbps a 1 Gbps) e **provedor (ISP)** — usados pelo gráfico de instabilidade para calcular a referência ANATEL (40% cabo / 30% WiFi).
- **Tipo de conexão**: automático, cabeada ou WiFi.
- **Intervalo entre testes**: 1, 2, 3, 5, 10, 15 (recomendado), 20, 30, 45, 60, 120 ou 240 minutos.
- **Limite para alerta de rede lenta** — usado apenas para marcar o resultado como "slow" no histórico.
- **Notificações do sistema** — dispara notificações desktop nas transições online/offline.
- **Iniciar com o sistema** — registra o app para abrir automaticamente (o rótulo adapta-se a Windows / macOS / Linux).

## Onde ficam os dados

| Plataforma | Banco SQLite                                             | Log                                                      | Cache do Speedtest CLI                                 |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| macOS      | `~/Library/Application Support/network-connection/speed.db` | `~/Library/Application Support/network-connection/main.log` | `~/Library/Application Support/network-connection/speedtest-cli/` |
| Linux      | `~/.config/network-connection/speed.db`                 | `~/.config/network-connection/main.log`                 | `~/.config/network-connection/speedtest-cli/`          |
| Windows    | `%APPDATA%\network-connection\speed.db`                 | `%APPDATA%\network-connection\main.log`                 | `%APPDATA%\network-connection\speedtest-cli\`          |

Ver o log no PowerShell:

```powershell
type "$env:APPDATA\network-connection\main.log"
```

## Problemas comuns

### `darwin on arm64 not supported`

Esse erro só ocorria em versões antigas que usavam `speedtest-net`. A partir dos commits recentes o app baixa o Ookla CLI oficial (binário universal no macOS, nativo em Apple Silicon). Basta reinstalar:

```bash
pnpm app:reinstall
```

### `Electron uninstall` ao rodar `pnpm dev`

Install incompleto do Electron via pnpm.

```powershell
pnpm approve-builds
pnpm install
pnpm rebuild electron better-sqlite3
```

### `better_sqlite3.node is not a valid Win32 application`

Build Windows gerado no Linux. Gere `pnpm dist:win` em uma máquina Windows.

### `Could not find any Python installation to use`

`node-gyp` não acha Python. Instale Python 3.11 e configure `PYTHON` / `npm_config_python`.

### `Could not find any Visual Studio installation to use`

Instale o Visual Studio 2022 Build Tools com a workload *Desktop development with C++*.

### `Ignored build scripts` no pnpm

```powershell
pnpm approve-builds
```

### O ícone do tray some no Linux

Alguns ambientes desktop exigem uma extensão (ex: GNOME precisa de *AppIndicator and KStatusNotifierItem Support*) para mostrar ícones de tray.

## Observações

- O renderer usa `HashRouter` para funcionar com `file://` no app empacotado.
- O Ookla CLI é baixado uma única vez (≈1 MB) na primeira execução e reutilizado.
- Para parar completamente o app, use "Sair" pelo menu do tray — fechar a janela principal apenas oculta a UI.
