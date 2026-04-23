import { BrowserWindow } from "electron";
import { getDb } from "../database/connection";
import { runSpeedTest } from "./speedtest.service";
import {
  showInternetDownNotification,
  showInternetRestoredNotification,
} from "./notification.service";
import { getNetworkInfo } from "./network-info.service";
import { IPC_CHANNELS } from "../ipc/channels";
import { writeMainLog } from "../utils/logger";
import {
  setTrayOffline,
  setTrayOnline,
  setTrayTesting,
  type ConnectivityStatus,
} from "./tray.service";

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalMs: number;
  private thresholdMbps: number;
  private connectionTypeOverride: string;
  private nextTestAt: number = 0;
  private lastConnectivity: ConnectivityStatus = "unknown";

  constructor(
    intervalMinutes: number,
    thresholdMbps: number,
    connectionType = "auto",
  ) {
    this.intervalMs = intervalMinutes * 60 * 1000;
    this.thresholdMbps = thresholdMbps;
    this.connectionTypeOverride = connectionType;
  }

  start(): void {
    this.scheduleNext();
    this.startTickTimer();
    this.executeTest();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.timer = null;
    this.tickTimer = null;
  }

  updateInterval(minutes: number): void {
    this.intervalMs = minutes * 60 * 1000;
    this.stop();
    this.start();
  }

  updateThreshold(mbps: number): void {
    this.thresholdMbps = mbps;
  }

  updateConnectionType(type: string): void {
    this.connectionTypeOverride = type;
  }

  runNow(): void {
    this.executeTest();
  }

  private scheduleNext(): void {
    if (this.timer) clearTimeout(this.timer);
    this.nextTestAt = Date.now() + this.intervalMs;
    this.timer = setTimeout(() => {
      this.executeTest();
      this.scheduleNext();
    }, this.intervalMs);
  }

  private startTickTimer(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => {
      const nextInSeconds = Math.max(
        0,
        Math.round((this.nextTestAt - Date.now()) / 1000),
      );
      this.broadcast(IPC_CHANNELS.SCHEDULER_TICK, { nextInSeconds });
    }, 1000);
  }

  private async executeTest(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    setTrayTesting(true);
    this.broadcast(IPC_CHANNELS.TEST_STARTED, null);

    try {
      const [result, netInfo] = await Promise.all([
        runSpeedTest(),
        getNetworkInfo(),
      ]);

      const db = getDb();
      const isSlow = result.download < this.thresholdMbps ? 1 : 0;

      const resolvedType =
        this.connectionTypeOverride === "auto"
          ? netInfo.connectionType
          : this.connectionTypeOverride;

      const userIsp = (
        db
          .prepare("SELECT value FROM settings WHERE key = 'isp_name'")
          .get() as { value: string } | undefined
      )?.value;
      const ispName =
        userIsp && userIsp.trim() !== "" ? userIsp : netInfo.ispName;

      db.prepare(
        `
        INSERT INTO speed_results
          (tested_at, download, upload, ping, jitter, server_host, is_slow,
           network_name, isp_name, connection_type,
           packet_loss, result_url, server_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        result.testedAt,
        result.download,
        result.upload,
        result.ping,
        result.jitter,
        result.serverHost,
        isSlow,
        netInfo.networkName,
        ispName,
        resolvedType,
        result.packetLoss,
        result.resultUrl,
        result.serverName,
      );

      const saved = db
        .prepare("SELECT * FROM speed_results ORDER BY id DESC LIMIT 1")
        .get();

      setTrayOnline({
        download: result.download,
        upload: result.upload,
        ping: result.ping,
        testedAt: result.testedAt,
      });

      this.broadcast(IPC_CHANNELS.TEST_COMPLETED, saved);

      if (this.lastConnectivity === "offline") {
        showInternetRestoredNotification(result.download);
      }
      this.lastConnectivity = "online";

      if (isSlow) {
        this.broadcast(IPC_CHANNELS.SPEED_ALERT, {
          download: result.download,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const testedAt = new Date().toISOString();
      writeMainLog("Speed test failed", {
        message,
        stack: err instanceof Error ? err.stack : undefined,
      });
      setTrayOffline(testedAt);
      this.broadcast(IPC_CHANNELS.TEST_FAILED, { error: message });

      if (this.lastConnectivity !== "offline") {
        showInternetDownNotification();
      }
      this.lastConnectivity = "offline";
    } finally {
      this.isRunning = false;
    }
  }

  private broadcast(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }
}
