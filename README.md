# Network Monitor

Aplicativo desktop em Electron + React para monitorar velocidade de internet, armazenar histórico em SQLite e exibir alertas quando a conexão ficar abaixo do limite configurado.

## Stack

- Electron 32
- electron-vite
- React 18
- TypeScript
- Tailwind CSS
- Recharts
- SQLite com better-sqlite3
- speedtest-net

## Requisitos

### Linux

- Node.js 20 LTS
- npm
- build-essential
- Python 3
- wine32 apenas se for gerar instalador Windows a partir do Linux

### Windows

- Node.js 20 LTS
- npm ou pnpm
- Python 3.11
- Visual Studio 2022 Build Tools com C++

## Dependencias nativas

Este projeto usa modulos nativos, principalmente `better-sqlite3`. O fluxo de build para Windows tambem pode exigir compilacao de dependencias transitivas como `lzma-native`.

Impacto pratico:

- o build Windows deve ser feito no Windows
- no Windows, Python e C++ Build Tools precisam estar configurados
- no Linux, o build Linux funciona normalmente com toolchain padrao

## Instalacao no Linux

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y build-essential python3 make g++
```

### Instalar Node 20

Se voce usa nvm:

```bash
nvm install 20
nvm use 20
node -v
npm -v
```

### Instalar dependencias do projeto

```bash
cd /home/ricardo/dev/network-connection
npm install
```

## Executar no Linux

### Desenvolvimento

```bash
npm run dev
```

### Build de producao

```bash
npm run build
```

### Empacotar para Linux

```bash
npm run dist
```

Arquivos gerados em `dist/`.

## Instalacao no Windows

Recomendacao: copie o projeto para uma pasta nativa do Windows, por exemplo `C:\dev\network-connection`, em vez de rodar direto em caminho UNC do WSL.

### 1. Instalar Node.js 20 com nvm-windows

No PowerShell:

```powershell
nvm install 20.18.0
nvm use 20.18.0
node -v
npm -v
```

### 2. Instalar Python 3.11

```powershell
winget install -e --id Python.Python.3.11
```

Depois feche e reabra o PowerShell e valide:

```powershell
py -3.11 --version
python --version
```

Se necessario, configure as variaveis de ambiente para o node-gyp:

```powershell
$env:PYTHON="C:\Users\Ricardo Mendes\AppData\Local\Programs\Python\Python311\python.exe"
$env:npm_config_python="C:\Users\Ricardo Mendes\AppData\Local\Programs\Python\Python311\python.exe"
```

Para persistir:

```powershell
setx PYTHON "C:\Users\Ricardo Mendes\AppData\Local\Programs\Python\Python311\python.exe"
setx npm_config_python "C:\Users\Ricardo Mendes\AppData\Local\Programs\Python\Python311\python.exe"
```

### 3. Instalar Visual Studio 2022 Build Tools

Opcao silenciosa:

```powershell
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Opcao com interface:

```powershell
winget install -e --id Microsoft.VisualStudio.2022.BuildTools
```

Na instalacao, inclua:

- Desktop development with C++
- MSVC v143
- Windows 10 SDK ou Windows 11 SDK

### 4. Instalar dependencias do projeto

Com npm:

```powershell
cd "C:\dev\network-connection"
npm install
```

Com pnpm:

```powershell
cd "C:\dev\network-connection"
pnpm approve-builds
pnpm install
pnpm rebuild electron better-sqlite3 lzma-native esbuild
```

Se o pnpm avisar sobre scripts ignorados, aprove pelo menos:

- better-sqlite3
- electron
- esbuild
- lzma-native

## Executar no Windows

### Desenvolvimento com npm

```powershell
cd "C:\dev\network-connection"
npm run dev
```

### Desenvolvimento com pnpm

```powershell
cd "C:\dev\network-connection"
pnpm run dev
```

### Build de producao

```powershell
npm run build
```

## Gerar instalador Windows

O instalador Windows deve ser gerado no Windows. O projeto bloqueia `dist:win` em host Linux porque os modulos nativos gerados la ficam invalidos no Windows.

```powershell
cd "C:\dev\network-connection"
npm run dist:win
```

Arquivos gerados em `dist/`.

## Comandos principais

```bash
npm run dev
npm run build
npm run dist
npm run dist:win
```

## Banco de dados

O banco SQLite fica no diretoria de dados do aplicativo.

- Linux: `~/.config/network-connection/speed.db`
- Windows: `%APPDATA%\network-connection\speed.db`

## Logs

O processo principal grava log em `main.log`.

- Linux: `~/.config/network-connection/main.log`
- Windows: `%APPDATA%\network-connection\main.log`

Exemplo no PowerShell:

```powershell
type "$env:APPDATA\network-connection\main.log"
```

## Problemas comuns

### `Electron uninstall` ao rodar `pnpm run dev`

Causa comum: install incompleto do Electron via pnpm.

Correcao:

```powershell
pnpm approve-builds
pnpm install
pnpm rebuild electron better-sqlite3
```

### `better_sqlite3.node is not a valid Win32 application`

Causa: build Windows gerado no Linux.

Correcao: gerar `dist:win` em maquina Windows.

### `Could not find any Python installation to use`

Causa: Python nao configurado para o node-gyp.

Correcao: instalar Python 3.11 e configurar `PYTHON` e `npm_config_python`.

### `Could not find any Visual Studio installation to use`

Causa: Build Tools C++ ausente.

Correcao: instalar Visual Studio 2022 Build Tools com workload C++.

### `Ignored build scripts` no pnpm

Causa: protecao do pnpm para scripts de instalacao.

Correcao:

```powershell
pnpm approve-builds
```

## Observacoes

- O renderer usa `HashRouter`, o que e necessario para empacotamento via `file://`.
- `speedtest-net` fica em `asarUnpack` para evitar falhas no app empacotado.
- Para ambiente Windows, `npm` tende a ser o caminho mais simples.
