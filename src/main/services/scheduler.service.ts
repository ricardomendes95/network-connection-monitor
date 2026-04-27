import { BrowserWindow } from "electron";
import { getDb } from "../database/connection";
import { runSpeedTest } from "./speedtest.service";
import {
  showInternetDownNotification,
  showInternetRestoredNotification,
} from "./notification.service";
import { getNetworkInfo } from "./network-info.service";
import { activeNetworkService } from "./active-network.service";
import { IPC_CHANNELS } from "../ipc/channels";
import { writeMainLog } from "../utils/logger";
import {
  setTrayOffline,
  setTrayOnline,
  setTrayTesting,
  type ConnectivityStatus,
} from "./tray.service";
import { showOverlayWindow, hideOverlayWindowAfter } from "./overlay-toast.service";
import { getNotifPref } from "./notification-prefs";

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private onlineIntervalMs: number;
  private offlineIntervalMs: number;
  private nextTestAt: number = 0;
  private lastConnectivity: ConnectivityStatus = "unknown";

  constructor(onlineIntervalMinutes: number, offlineIntervalSeconds: number) {
    this.onlineIntervalMs = onlineIntervalMinutes * 60 * 1000;
    this.offlineIntervalMs = offlineIntervalSeconds * 1000;
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

  updateIntervals(opts: {
    onlineMinutes?: number;
    offlineSeconds?: number;
  }): void {
    if (opts.onlineMinutes !== undefined && opts.onlineMinutes > 0) {
      this.onlineIntervalMs = opts.onlineMinutes * 60 * 1000;
    }
    if (opts.offlineSeconds !== undefined && opts.offlineSeconds > 0) {
      this.offlineIntervalMs = opts.offlineSeconds * 1000;
    }
    this.stop();
    this.start();
  }

  runNow(): void {
    this.executeTest();
  }

  private currentIntervalMs(): number {
    return this.lastConnectivity === "offline"
      ? this.offlineIntervalMs
      : this.onlineIntervalMs;
  }

  private scheduleNext(): void {
    if (this.timer) clearTimeout(this.timer);
    const ms = this.currentIntervalMs();
    this.nextTestAt = Date.now() + ms;
    this.timer = setTimeout(() => {
      this.executeTest();
      this.scheduleNext();
    }, ms);
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
    const showOverlay = getNotifPref("notify_test_overlay");
    if (showOverlay) showOverlayWindow();
    this.broadcast(IPC_CHANNELS.TEST_STARTED, null);

    try {
      const [result, netInfo] = await Promise.all([
        runSpeedTest(),
        getNetworkInfo(),
      ]);

      activeNetworkService.reconcile(netInfo);
      const active = activeNetworkService.getActive();
      const threshold = active?.slow_threshold_mbps ?? 10;
      const isSlow = result.download < threshold ? 1 : 0;

      const ispName =
        active && active.isp_name.trim() !== "" ? active.isp_name : netInfo.ispName;

      const db = getDb();
      db.prepare(
        `
        INSERT INTO speed_results
          (tested_at, download, upload, ping, jitter, server_host, is_slow,
           network_name, isp_name, connection_type,
           packet_loss, result_url, server_name, network_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        netInfo.connectionType,
        result.packetLoss,
        result.resultUrl,
        result.serverName,
        active?.id ?? null,
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
      if (showOverlay) hideOverlayWindowAfter(3000);

      if (
        this.lastConnectivity === "offline" &&
        getNotifPref("notify_internet_restored")
      ) {
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
      if (showOverlay) hideOverlayWindowAfter(4000);

      if (
        this.lastConnectivity !== "offline" &&
        getNotifPref("notify_internet_down")
      ) {
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
