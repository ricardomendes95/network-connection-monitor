import { app, shell, BrowserWindow, dialog } from "electron";
import { join } from "node:path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { runMigrations } from "./database/migrations";
import { closeDb, getDb } from "./database/connection";
import { SchedulerService } from "./services/scheduler.service";
import { registerHandlers } from "./ipc/handlers";
import { getNetworkInfo } from "./services/network-info.service";
import { createTray } from "./services/tray.service";
import { IPC_CHANNELS } from "./ipc/channels";
import { writeMainLog } from "./utils/logger";

let scheduler: SchedulerService | null = null;
let mainWindowRef: BrowserWindow | null = null;

function ensureMainWindow(): BrowserWindow {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    if (mainWindowRef.isMinimized()) mainWindowRef.restore();
    mainWindowRef.show();
    mainWindowRef.focus();
    return mainWindowRef;
  }
  mainWindowRef = createWindow();
  return mainWindowRef;
}

function showFatalError(title: string, error: unknown): void {
  const message =
    error instanceof Error
      ? `${error.message}\n\n${error.stack ?? ""}`
      : String(error);
  writeMainLog(title, { message });

  try {
    dialog.showErrorBox(title, message);
  } catch {}
}

process.on("uncaughtException", (error) => {
  showFatalError("Erro no processo principal", error);
});

process.on("unhandledRejection", (reason) => {
  showFatalError("Promise rejeitada no processo principal", reason);
});

function getIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "resources", "tray-icon.png")
    : join(app.getAppPath(), "resources", "tray-icon.png");
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: true,
    title: "Conexão Flow",
    autoHideMenuBar: true,
    backgroundColor: "#101418",
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  let didShowWindow = false;
  const revealWindow = () => {
    if (didShowWindow || mainWindow.isDestroyed()) return;
    didShowWindow = true;
    writeMainLog("Revealing main window");
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  mainWindow.once("ready-to-show", revealWindow);
  mainWindow.webContents.once("did-finish-load", revealWindow);
  mainWindow.on("show", () => writeMainLog("Main window shown"));
  mainWindow.on("closed", () => {
    writeMainLog("Main window closed");
    if (mainWindowRef === mainWindow) mainWindowRef = null;
  });
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      writeMainLog("Renderer failed to load", {
        errorCode,
        errorDescription,
        validatedURL,
      });
      revealWindow();
    },
  );
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    writeMainLog("Renderer process gone", details);
    revealWindow();
  });
  setTimeout(revealWindow, 3000);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    writeMainLog("Loading renderer URL", {
      url: process.env["ELECTRON_RENDERER_URL"],
    });
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    writeMainLog("Loading renderer file", {
      file: join(__dirname, "../renderer/index.html"),
    });
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

app
  .whenReady()
  .then(() => {
    electronApp.setAppUserModelId("com.ricardo.network-connection");
    writeMainLog("App ready");

    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    runMigrations();
    writeMainLog("Migrations completed");

    const db = getDb();
    const getVal = (key: string, fallback: string): string =>
      (
        db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
          | { value: string }
          | undefined
      )?.value ?? fallback;

    const intervalMinutes = Number(getVal("interval_minutes", "15"));
    const thresholdMbps = Number(getVal("slow_threshold_mbps", "10"));
    const connectionType = getVal("connection_type", "auto");

    scheduler = new SchedulerService(
      intervalMinutes,
      thresholdMbps,
      connectionType,
    );
    registerHandlers(scheduler);
    writeMainLog("IPC handlers registered");

    mainWindowRef = createWindow();
    createTray({
      onRunNow: () => scheduler?.runNow(),
      onOpenMain: () => ensureMainWindow(),
    });

    // Detecta rede ao vivo e envia para o renderer antes do primeiro teste
    setTimeout(async () => {
      try {
        const info = await getNetworkInfo();
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed())
            win.webContents.send(IPC_CHANNELS.NETWORK_INFO_UPDATE, info);
        }
      } catch {}
      scheduler?.start();
    }, 1500);

    app.on("activate", () => {
      ensureMainWindow();
    });
  })
  .catch((error) => {
    showFatalError("Falha ao inicializar o aplicativo", error);
  });

app.on("window-all-closed", () => {
  // O app continua rodando em segundo plano pelo tray/menu bar.
  // Para sair, o usuário usa a opção "Sair" do menu do tray.
  writeMainLog("All windows closed — mantendo app ativo no tray");
});

app.on("before-quit", () => {
  writeMainLog("Before quit — parando scheduler e fechando DB");
  scheduler?.stop();
  closeDb();
});
