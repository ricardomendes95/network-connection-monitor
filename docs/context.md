# Network Connection Monitor — Contexto do Projeto

## Objetivo
App desktop (Electron + React) que monitora automaticamente a velocidade da internet, salva histórico em SQLite e alerta o usuário quando a conexão estiver lenta.

## Funcionalidades Principais
- Testes automáticos de velocidade (download / upload / ping) a cada 15 minutos (padrão indústria)
- Detecção automática de rede (SSID/nome da interface) e provedor (ISP via ip-api.com)
- Avaliação da velocidade com base no plano contratado e tipo de conexão (cabo/WiFi)
  - Ref. ANATEL Resolução 614/2013: cabo exige mínimo 40% instantâneo, média 80%
  - WiFi: sem garantia legal, tolerância prática 25–60%
- Alerta visual pulsante quando download < threshold (configurável)
- Notificação desktop com fallback para WSL
- Gráficos de oscilação ao longo do dia e da semana
- Heatmap de lentidão: hora × dia-da-semana
- Histórico completo com filtros por período
- Configurações persistidas (intervalo, threshold, toggle de notificações)

## Stack
| Camada | Tecnologia |
|---|---|
| Desktop | Electron 32 + electron-vite |
| Frontend | React 18 + TypeScript |
| UI | Shadcn/ui + Tailwind CSS |
| Gráficos | Recharts |
| Banco | better-sqlite3 (SQLite) |
| Estado | Zustand |
| Roteamento | react-router-dom (HashRouter — obrigatório para file://) |
| Speed test | speedtest-net |

## Arquitetura

### Main Process (Node.js / Electron)
- `src/main/index.ts` — entry point, cria BrowserWindow, inicia scheduler
- `src/main/database/connection.ts` — singleton DB, path em `app.getPath('userData')`
- `src/main/database/migrations.ts` — CREATE TABLE na inicialização
- `src/main/services/speedtest.service.ts` — wrapper speedtest-net com retry
- `src/main/services/scheduler.service.ts` — setInterval com flag `isRunning`
- `src/main/services/notification.service.ts` — Electron Notification + try/catch (WSL)
- `src/main/ipc/channels.ts` — enum de nomes de canais
- `src/main/ipc/handlers.ts` — todos os ipcMain.handle()

### Preload (ponte segura)
- `src/preload/index.ts` — contextBridge.exposeInMainWorld('electronAPI', {...})
- Nunca usar nodeIntegration: true — todo acesso ao Node via preload

### Renderer (React)
- `src/renderer/src/types/index.ts` — interfaces TypeScript
- `src/renderer/src/lib/ipc.ts` — wrapper typesafe sobre window.electronAPI
- `src/renderer/src/store/speedStore.ts` — Zustand store global
- `src/renderer/src/hooks/useSpeedData.ts` — IPC listeners + estado de resultados
- `src/renderer/src/hooks/useSettings.ts` — lê/salva configurações

## Schema SQLite

```sql
CREATE TABLE speed_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tested_at   TEXT NOT NULL,      -- ISO 8601
  download    REAL NOT NULL,      -- Mbps
  upload      REAL NOT NULL,      -- Mbps
  ping        REAL NOT NULL,      -- ms
  jitter      REAL,
  server_host TEXT,
  is_slow     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- interval_minutes = '10'
-- slow_threshold_mbps = '10'
-- notifications_enabled = 'true'
```

## Canais IPC

### Renderer → Main (invoke/handle)
- `speed:get-history` — histórico paginado
- `speed:get-chart-data` — dados agregados (heatmap, barchart, linechart)
- `speed:run-now` — dispara teste imediato
- `settings:get` / `settings:set` — configurações

### Main → Renderer (push via webContents.send)
- `speed:test-started` — teste iniciou
- `speed:test-completed` — resultado com SpeedResult
- `speed:test-failed` — erro string
- `speed:alert` — velocidade < threshold
- `speed:scheduler-tick` — `{ nextInSeconds: number }`

## Armadilhas Críticas

1. **better-sqlite3 rebuild**: módulo nativo C++, precisa de `electron-rebuild` após `npm install`. Está no `postinstall` do package.json e em `externals` do vite config.

2. **Path do banco**: sempre `app.getPath('userData')` — nunca path relativo.
   - Linux: `~/.config/network-connection/speed.db`
   - Windows: `%APPDATA%/network-connection/speed.db`

3. **HashRouter obrigatório**: Electron carrega via `file://`, BrowserRouter quebra a navegação.

4. **contextIsolation**: `nodeIntegration: false` (padrão seguro). Todo Node.js via preload + contextBridge.

5. **Notificações WSL**: Electron Notification pode falhar sem D-Bus. Sempre envolver em try/catch; usar AlertBanner como fallback visual.

6. **Teste lento (15-30s)**: Flag `isRunning` no scheduler impede sobreposição de testes. Renderer exibe estado "testando" via evento `TEST_STARTED`.

## Queries SQL para Gráficos

```sql
-- Heatmap: hora × dia-da-semana (últimos 7 dias)
SELECT strftime('%w', tested_at) AS day,
       strftime('%H', tested_at) AS hour,
       AVG(download) AS avg_download
FROM speed_results
WHERE tested_at >= datetime('now', '-7 days')
GROUP BY day, hour;

-- Barchart: média por dia da semana
SELECT strftime('%w', tested_at) AS day_of_week,
       AVG(download) AS avg_download,
       MIN(download) AS min_download,
       COUNT(CASE WHEN is_slow=1 THEN 1 END) AS slow_count
FROM speed_results GROUP BY day_of_week;

-- LineChart: hoje
SELECT tested_at, download, upload, ping
FROM speed_results
WHERE date(tested_at) = date('now')
ORDER BY tested_at ASC;
```

## Verificação / Como Testar
1. `npm install` (roda postinstall → electron-rebuild)
2. `npm run dev` — abre janela Electron com React
3. Clicar "Testar Agora" → resultado salvo no DB e exibido nos cards
4. Aguardar intervalo automático → novo resultado aparece
5. Simular rede lenta: configurar threshold alto em Settings → AlertBanner aparece
6. Página Charts → heatmap e barchart com dados históricos
7. Página Histórico → tabela com todos os resultados
