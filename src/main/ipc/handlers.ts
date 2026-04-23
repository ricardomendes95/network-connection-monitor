import { ipcMain, dialog, BrowserWindow, app } from "electron";
import fs from "fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../database/connection";
import { IPC_CHANNELS } from "./channels";
import { getNetworkInfo } from "../services/network-info.service";
import type { SchedulerService } from "../services/scheduler.service";

export function registerHandlers(scheduler: SchedulerService): void {
  ipcMain.handle(
    IPC_CHANNELS.GET_HISTORY,
    (_event, filter: { days?: number; page?: number; limit?: number } = {}) => {
      const db = getDb();
      const days = filter.days ?? 7;
      const limit = filter.limit ?? 50;
      const offset = ((filter.page ?? 1) - 1) * limit;

      const rows = db
        .prepare(
          `
      SELECT * FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
      ORDER BY tested_at DESC
      LIMIT ? OFFSET ?
    `,
        )
        .all(days, limit, offset);

      const total = (
        db
          .prepare(
            `
      SELECT COUNT(*) as count FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
    `,
          )
          .get(days) as { count: number }
      ).count;

      return { rows, total, page: filter.page ?? 1, limit };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_CHART_DATA,
    (
      _event,
      type: "heatmap" | "daily" | "timeline" | "weekly" | "instability",
      days = 7,
      options?: { contracted_mbps?: number; connection_type?: string },
    ) => {
      const db = getDb();

      if (type === "heatmap") {
        return db
          .prepare(
            `
        SELECT strftime('%w', tested_at) AS day,
               strftime('%H', tested_at) AS hour,
               AVG(download) AS avg_download,
               MIN(download) AS min_download,
               COUNT(*) AS total
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day, hour
        ORDER BY day, hour
      `,
          )
          .all(days);
      }

      if (type === "daily") {
        return db
          .prepare(
            `
        SELECT strftime('%w', tested_at) AS day_of_week,
               AVG(download) AS avg_download,
               AVG(upload) AS avg_upload,
               MIN(download) AS min_download,
               COUNT(*) AS total,
               COUNT(CASE WHEN is_slow=1 THEN 1 END) AS slow_count
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day_of_week
        ORDER BY day_of_week
      `,
          )
          .all(days);
      }

      if (type === "timeline") {
        return db
          .prepare(
            `
        SELECT tested_at, download, upload, ping, is_slow
        FROM speed_results
        WHERE date(tested_at) = date('now')
        ORDER BY tested_at ASC
      `,
          )
          .all();
      }

      if (type === "weekly") {
        return db
          .prepare(
            `
        SELECT date(tested_at) AS day,
               AVG(download) AS avg_download,
               MIN(download) AS min_download,
               COUNT(*) AS total,
               COUNT(CASE WHEN is_slow=1 THEN 1 END) AS slow_count
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day
        ORDER BY day ASC
      `,
          )
          .all(days);
      }

      if (type === "instability") {
        const contracted = options?.contracted_mbps ?? 0;
        const connType = options?.connection_type ?? "auto";

        // Threshold ANATEL: cabo 40%, WiFi 30%; fallback = slow_threshold_mbps da settings
        let anatelThreshold = 0;
        if (contracted > 0) {
          anatelThreshold =
            connType === "wifi" ? contracted * 0.3 : contracted * 0.4;
        }

        // Se não tiver velocidade contratada configurada, usa o threshold salvo nas settings
        if (anatelThreshold <= 0) {
          const row = db
            .prepare(
              "SELECT value FROM settings WHERE key = 'slow_threshold_mbps'",
            )
            .get() as { value: string } | undefined;
          anatelThreshold = Number(row?.value ?? 10);
        }

        // Todos os dias medidos no período, contando quedas pelo threshold ANATEL
        const slowDays = db
          .prepare(
            `
        SELECT date(tested_at) AS day,
               COUNT(*) AS total,
               COUNT(CASE WHEN download < ? THEN 1 END) AS slow_count
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day
        ORDER BY day DESC
      `,
          )
          .all(anatelThreshold, days);

        const connectionComparison = db
          .prepare(
            `
        SELECT connection_type,
               AVG(download) AS avg_download,
               COUNT(*) AS total
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY connection_type
      `,
          )
          .all(days);

        // Por dia + hora com instabilidade (avg abaixo do threshold ANATEL)
        const dailyHourly = db
          .prepare(
            `
        SELECT date(tested_at) AS day,
               strftime('%H', tested_at) AS hour,
               AVG(download) AS avg_download,
               MIN(download) AS min_download,
               MAX(download) AS max_download,
               COUNT(*) AS total,
               COUNT(CASE WHEN download < ? THEN 1 END) AS slow_count
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day, hour
        HAVING AVG(download) < ? OR MIN(download) < ?
        ORDER BY day DESC, hour ASC
      `,
          )
          .all(anatelThreshold, days, anatelThreshold, anatelThreshold);

        const totalSlowDays = (slowDays as { slow_count: number }[]).filter(
          (d) => d.slow_count > 0,
        ).length;

        return {
          slowDays,
          connectionComparison,
          dailyHourly,
          totalSlowDays,
          anatelThreshold,
        };
      }

      return [];
    },
  );

  ipcMain.handle(IPC_CHANNELS.RUN_NOW, async () => {
    scheduler.runNow();
    return { queued: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_NETWORK_INFO, async () => {
    return await getNetworkInfo();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    (_event, settings: Record<string, string>) => {
      const db = getDb();
      const upsert = db.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      );
      const upsertMany = db.transaction((entries: [string, string][]) => {
        for (const [key, value] of entries) upsert.run(key, value);
      });
      upsertMany(Object.entries(settings));

      if (settings.interval_minutes) {
        scheduler.updateInterval(Number(settings.interval_minutes));
      }
      if (settings.slow_threshold_mbps) {
        scheduler.updateThreshold(Number(settings.slow_threshold_mbps));
      }
      if (settings.connection_type) {
        scheduler.updateConnectionType(settings.connection_type);
      }

      return { ok: true };
    },
  );

  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false };

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      landscape: true,
    });

    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: `relatorio-rede-${new Date().toISOString().split("T")[0]}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (filePath) {
      fs.writeFileSync(filePath, pdfBuffer);
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_PNG, async (event, dataUrl: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { filePath } = await dialog.showSaveDialog(win ?? undefined, {
      defaultPath: `relatorio-rede-${new Date().toISOString().split("T")[0]}.png`,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });

    if (filePath) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_EVIDENCE,
    async (
      event,
      days: number = 30,
      opts?: { contracted_mbps?: number; connection_type?: string },
    ) => {
      const db = getDb();
      const win = BrowserWindow.fromWebContents(event.sender);

      const contracted = opts?.contracted_mbps ?? 0;

      let wiredThreshold = 0;
      let wifiThreshold = 0;
      if (contracted > 0) {
        wiredThreshold = contracted * 0.4;
        wifiThreshold = contracted * 0.3;
      }
      if (wiredThreshold <= 0) {
        const row = db
          .prepare(
            "SELECT value FROM settings WHERE key = 'slow_threshold_mbps'",
          )
          .get() as { value: string } | undefined;
        wiredThreshold = Number(row?.value ?? 10);
        wifiThreshold = wiredThreshold;
      }

      const ispRow = db
        .prepare("SELECT value FROM settings WHERE key = 'isp_name'")
        .get() as { value: string } | undefined;
      const ispName = ispRow?.value?.trim() || "Não configurado";

      interface EvidenceRow {
        tested_at: string;
        download: number;
        upload: number;
        ping: number;
        jitter: number | null;
        packet_loss: number | null;
        connection_type: string | null;
        network_name: string | null;
        isp_name: string | null;
        server_host: string | null;
        server_name: string | null;
        result_url: string | null;
      }

      const violations = db
        .prepare(
          `
      SELECT tested_at, download, upload, ping, jitter, packet_loss,
             connection_type, network_name, isp_name, server_host, server_name, result_url
      FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
        AND (
          (connection_type = 'wifi' AND download < ?)
          OR ((connection_type IS NULL OR connection_type != 'wifi') AND download < ?)
        )
      ORDER BY tested_at DESC
    `,
        )
        .all(days, wifiThreshold, wiredThreshold) as EvidenceRow[];

      const stats = db
        .prepare(
          `
      SELECT COUNT(*) as total,
             COUNT(CASE
               WHEN connection_type = 'wifi' AND download < ? THEN 1
               WHEN (connection_type IS NULL OR connection_type != 'wifi') AND download < ? THEN 1
             END) as violations,
             AVG(download) as avg_download,
             AVG(ping) as avg_ping,
             AVG(packet_loss) as avg_packet_loss,
             COUNT(DISTINCT date(tested_at)) as total_days,
             COUNT(DISTINCT CASE
               WHEN connection_type = 'wifi' AND download < ? THEN date(tested_at)
               WHEN (connection_type IS NULL OR connection_type != 'wifi') AND download < ? THEN date(tested_at)
             END) as violation_days
      FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
    `,
        )
        .get(
          wifiThreshold,
          wiredThreshold,
          wifiThreshold,
          wiredThreshold,
          days,
        ) as {
        total: number;
        violations: number;
        avg_download: number;
        avg_ping: number;
        avg_packet_loss: number | null;
        total_days: number;
        violation_days: number;
      };

      const worstHour = db
        .prepare(
          `
      SELECT strftime('%H', tested_at) as hour, COUNT(*) as cnt
      FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
        AND (
          (connection_type = 'wifi' AND download < ?)
          OR ((connection_type IS NULL OR connection_type != 'wifi') AND download < ?)
        )
      GROUP BY hour ORDER BY cnt DESC LIMIT 1
    `,
        )
        .get(days, wifiThreshold, wiredThreshold) as
        | { hour: string; cnt: number }
        | undefined;

      const dateRange = db
        .prepare(
          `
      SELECT MIN(date(tested_at)) as first_day, MAX(date(tested_at)) as last_day
      FROM speed_results WHERE tested_at >= datetime('now', '-' || ? || ' days')
    `,
        )
        .get(days) as { first_day: string | null; last_day: string | null };

      const now = new Date();

      const fmtDate = (iso: string) =>
        new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

      const fmtDateTime = (iso: string) =>
        new Date(iso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

      const esc = (v: string | number | null | undefined): string => {
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const row = (...cells: (string | number | null | undefined)[]) =>
        cells.map(esc).join(",");

      const violPct =
        stats.total > 0
          ? ((stats.violations / stats.total) * 100).toFixed(1)
          : "0";
      const avgPct =
        contracted > 0
          ? ` (${((stats.avg_download / contracted) * 100).toFixed(0)}% do plano)`
          : "";
      const threshLabel =
        contracted > 0
          ? `Cabo: ${wiredThreshold.toFixed(0)} Mbps (40%) / WiFi: ${wifiThreshold.toFixed(0)} Mbps (30%) — Res. ANATEL 614/2013`
          : `${wiredThreshold.toFixed(0)} Mbps (threshold configurado)`;
      const worstHourLabel = worstHour
        ? `${worstHour.hour}:00 - ${worstHour.hour}:59 (${worstHour.cnt} violações)`
        : "N/A";
      const packetLossLabel =
        stats.avg_packet_loss != null
          ? `${stats.avg_packet_loss.toFixed(2)}%`
          : "Dado não disponível (requer testes recentes)";

      const lines = [
        row("DOSSIÊ DE EVIDÊNCIAS - VIOLAÇÕES DE CONTRATO DE INTERNET"),
        "",
        row("Gerado em:", now.toLocaleString("pt-BR")),
        row("Operadora / ISP:", ispName),
        row(
          "Plano contratado:",
          contracted > 0 ? `${contracted} Mbps` : "Não configurado",
        ),
        row("Mínimo exigido ANATEL:", threshLabel),
        row(
          "Período analisado:",
          `${dateRange.first_day ? fmtDate(dateRange.first_day) : "—"} a ${dateRange.last_day ? fmtDate(dateRange.last_day) : "—"} (${days} dias)`,
        ),
        "",
        row("RESUMO ESTATÍSTICO"),
        row("Total de testes realizados:", stats.total),
        row(
          "Testes abaixo do mínimo ANATEL:",
          `${stats.violations} (${violPct}%)`,
        ),
        row(
          "Dias com ao menos 1 violação:",
          `${stats.violation_days} de ${stats.total_days} dias`,
        ),
        row(
          "Média de download no período:",
          `${stats.avg_download.toFixed(1)} Mbps${avgPct}`,
        ),
        row("Média de ping no período:", `${stats.avg_ping.toFixed(0)} ms`),
        row("Média de perda de pacotes:", packetLossLabel),
        row("Horário com maior incidência de lentidão:", worstHourLabel),
        "",
        row("MEDIÇÕES ABAIXO DO MÍNIMO ANATEL"),
        row(
          "Data/Hora",
          "Download (Mbps)",
          "% do Plano",
          "Upload (Mbps)",
          "Ping (ms)",
          "Jitter (ms)",
          "Perda de Pacotes (%)",
          "Tipo de Conexão",
          "Rede",
          "ISP",
          "Servidor",
          "Link de Verificação Ookla",
        ),
        ...violations.map((r) => {
          const pct =
            contracted > 0
              ? `${((r.download / contracted) * 100).toFixed(0)}%`
              : "N/A";
          const connLabel =
            r.connection_type === "wifi"
              ? "WiFi"
              : r.connection_type === "wired"
                ? "Cabo"
                : "";
          return row(
            fmtDateTime(r.tested_at),
            r.download.toFixed(2),
            pct,
            r.upload.toFixed(2),
            r.ping.toFixed(0),
            r.jitter != null ? r.jitter.toFixed(1) : "",
            r.packet_loss != null ? r.packet_loss.toFixed(2) : "",
            connLabel,
            r.network_name,
            r.isp_name,
            r.server_name ?? r.server_host,
            r.result_url,
          );
        }),
      ];

      const csvContent = lines.join("\r\n");
      const safeName = ispName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const defaultPath = `dossie-evidencias-${safeName}-${now.toISOString().split("T")[0]}.csv`;

      const { filePath } = await dialog.showSaveDialog(win ?? undefined, {
        defaultPath,
        filters: [
          { name: "CSV (Excel / LibreOffice)", extensions: ["csv"] },
          { name: "Todos os arquivos", extensions: ["*"] },
        ],
      });

      if (filePath) {
        fs.writeFileSync(filePath, "﻿" + csvContent, "utf8");
        return { ok: true, count: violations.length };
      }
      return { ok: false, count: 0 };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_EVIDENCE_PDF,
    async (
      event,
      days: number = 30,
      opts?: { contracted_mbps?: number; connection_type?: string },
    ) => {
      const db = getDb();
      const win = BrowserWindow.fromWebContents(event.sender);

      const contracted = opts?.contracted_mbps ?? 0;

      let wiredThreshold = 0;
      let wifiThreshold = 0;
      if (contracted > 0) {
        wiredThreshold = contracted * 0.4;
        wifiThreshold = contracted * 0.3;
      }
      if (wiredThreshold <= 0) {
        const tRow = db
          .prepare(
            "SELECT value FROM settings WHERE key = 'slow_threshold_mbps'",
          )
          .get() as { value: string } | undefined;
        wiredThreshold = Number(tRow?.value ?? 10);
        wifiThreshold = wiredThreshold;
      }

      const ispRow = db
        .prepare("SELECT value FROM settings WHERE key = 'isp_name'")
        .get() as { value: string } | undefined;
      const ispName = ispRow?.value?.trim() || "Não configurado";

      const dateRange = db
        .prepare(
          `
      SELECT MIN(date(tested_at)) as first_day, MAX(date(tested_at)) as last_day
      FROM speed_results WHERE tested_at >= datetime('now', '-' || ? || ' days')
    `,
        )
        .get(days) as { first_day: string | null; last_day: string | null };

      const stats = db
        .prepare(
          `
      SELECT COUNT(*) as total,
             COUNT(CASE
               WHEN connection_type = 'wifi' AND download < ? THEN 1
               WHEN (connection_type IS NULL OR connection_type != 'wifi') AND download < ? THEN 1
             END) as violations,
             AVG(download) as avg_download,
             AVG(upload) as avg_upload,
             AVG(ping) as avg_ping,
             AVG(packet_loss) as avg_packet_loss,
             COUNT(DISTINCT date(tested_at)) as total_days,
             COUNT(DISTINCT CASE
               WHEN connection_type = 'wifi' AND download < ? THEN date(tested_at)
               WHEN (connection_type IS NULL OR connection_type != 'wifi') AND download < ? THEN date(tested_at)
             END) as violation_days
      FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
    `,
        )
        .get(
          wifiThreshold,
          wiredThreshold,
          wifiThreshold,
          wiredThreshold,
          days,
        ) as {
        total: number;
        violations: number;
        avg_download: number;
        avg_upload: number;
        avg_ping: number;
        avg_packet_loss: number | null;
        total_days: number;
        violation_days: number;
      };

      const worstHour = db
        .prepare(
          `
      SELECT strftime('%H', tested_at) as hour, COUNT(*) as cnt
      FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
        AND (
          (connection_type = 'wifi' AND download < ?)
          OR ((connection_type IS NULL OR connection_type != 'wifi') AND download < ?)
        )
      GROUP BY hour ORDER BY cnt DESC LIMIT 1
    `,
        )
        .get(days, wifiThreshold, wiredThreshold) as
        | { hour: string; cnt: number }
        | undefined;

      interface DailyRow {
        day: string;
        connection_type: string;
        network_name: string | null;
        total: number;
        violations: number;
        min_download: number;
        avg_download: number;
        avg_upload: number;
      }
      const dailyStats = db
        .prepare(
          `
      SELECT date(tested_at) as day,
             COALESCE(connection_type, 'wired') as connection_type,
             MAX(network_name) as network_name,
             COUNT(*) as total,
             COUNT(CASE
               WHEN connection_type = 'wifi' AND download < ? THEN 1
               WHEN (connection_type IS NULL OR connection_type != 'wifi') AND download < ? THEN 1
             END) as violations,
             MIN(download) as min_download,
             AVG(download) as avg_download,
             AVG(upload) as avg_upload
      FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
      GROUP BY day, COALESCE(connection_type, 'wired')
      ORDER BY day DESC, connection_type
    `,
        )
        .all(wifiThreshold, wiredThreshold, days) as DailyRow[];

      interface ViolRow {
        tested_at: string;
        download: number;
        upload: number;
        ping: number;
        jitter: number | null;
        packet_loss: number | null;
        connection_type: string | null;
        network_name: string | null;
        server_name: string | null;
        server_host: string | null;
        result_url: string | null;
      }
      const violations = db
        .prepare(
          `
      SELECT tested_at, download, upload, ping, jitter, packet_loss,
             connection_type, network_name, server_name, server_host, result_url
      FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
        AND (
          (connection_type = 'wifi' AND download < ?)
          OR ((connection_type IS NULL OR connection_type != 'wifi') AND download < ?)
        )
      ORDER BY tested_at DESC
    `,
        )
        .all(days, wifiThreshold, wiredThreshold) as ViolRow[];

      const now = new Date();

      const h = (v: string | number | null | undefined) => {
        if (v == null) return "";
        return String(v)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };

      const fmtDate = (iso: string) =>
        new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

      const fmtDateTime = (iso: string) =>
        new Date(iso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

      const violPct =
        stats.total > 0
          ? ((stats.violations / stats.total) * 100).toFixed(1)
          : "0";
      const avgPct =
        contracted > 0
          ? ` (${((stats.avg_download / contracted) * 100).toFixed(0)}% do plano)`
          : "";
      const threshLabel =
        contracted > 0
          ? `Cabo: ${wiredThreshold.toFixed(0)} Mbps (40%) · WiFi: ${wifiThreshold.toFixed(0)} Mbps (30%)`
          : `${wiredThreshold.toFixed(0)} Mbps (threshold configurado)`;
      const worstHourLabel = worstHour
        ? `${worstHour.hour}:00 – ${worstHour.hour}:59 (${worstHour.cnt} ocorrências)`
        : "N/A";
      const firstDay = dateRange.first_day ? fmtDate(dateRange.first_day) : "—";
      const lastDay = dateRange.last_day ? fmtDate(dateRange.last_day) : "—";

      const dailyRowsHtml = dailyStats
        .map((d) => {
          const rate =
            d.total > 0 ? ((d.violations / d.total) * 100).toFixed(0) : "0";
          const isViol = d.violations > 0;
          const isWifi = d.connection_type === "wifi";
          const threshold = isWifi ? wifiThreshold : wiredThreshold;
          const typeLabel = isWifi ? "📶 WiFi" : "🔌 Cabo";
          const netLabel =
            isWifi && d.network_name
              ? `<br><span style="font-size:9px;color:#9ca3af">${h(d.network_name)}</span>`
              : "";
          return `<tr>
        <td>${h(fmtDate(d.day))}</td>
        <td style="white-space:nowrap">${typeLabel}${netLabel}</td>
        <td style="text-align:center">${d.total}</td>
        <td style="text-align:center" class="${isViol ? "td-danger" : "td-ok"}">${d.violations}</td>
        <td style="text-align:center" class="${isViol ? "td-danger" : "td-ok"}">${rate}%</td>
        <td class="${d.min_download < threshold ? "td-danger" : ""}">${d.min_download.toFixed(1)} Mbps</td>
        <td>${d.avg_download.toFixed(1)} Mbps</td>
        <td style="color:#6b7280">${d.avg_upload.toFixed(1)} Mbps</td>
      </tr>`;
        })
        .join("\n");

      const violRowsHtml = violations
        .map((r) => {
          const pct =
            contracted > 0
              ? `${((r.download / contracted) * 100).toFixed(0)}%`
              : "—";
          const isWifi = r.connection_type === "wifi";
          const connLabel = isWifi
            ? "📶 WiFi"
            : r.connection_type === "wired"
              ? "🔌 Cabo"
              : "—";
          const netLabel =
            isWifi && r.network_name
              ? `<br><span style="font-size:8.5px;color:#9ca3af">${h(r.network_name)}</span>`
              : "";
          const serverLabel = r.server_name ?? r.server_host ?? "—";
          const urlCell = r.result_url
            ? `<a href="${h(r.result_url)}" style="color:#2563eb;font-size:9px">${h(r.result_url)}</a>`
            : "—";
          return `<tr>
        <td>${h(fmtDateTime(r.tested_at))}</td>
        <td class="td-danger">${r.download.toFixed(2)} Mbps</td>
        <td class="td-danger">${pct}</td>
        <td style="color:#6b7280">${r.upload.toFixed(2)} Mbps</td>
        <td>${r.ping.toFixed(0)} ms</td>
        <td style="color:#6b7280">${r.jitter != null ? r.jitter.toFixed(1) + " ms" : "—"}</td>
        <td>${r.packet_loss != null ? r.packet_loss.toFixed(1) + "%" : "—"}</td>
        <td style="font-size:9.5px">${connLabel}${netLabel}</td>
        <td style="color:#6b7280;font-size:9.5px">${h(serverLabel)}</td>
        <td style="font-size:9px">${urlCell}</td>
      </tr>`;
        })
        .join("\n");

      const packetLossCell =
        stats.avg_packet_loss != null
          ? `<div class="extra-item">
          <div class="extra-label">Perda de Pacotes Média</div>
          <div class="extra-value">${stats.avg_packet_loss.toFixed(2)}%</div>
        </div>`
          : "";

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#111827;background:#fff;padding:32px}
@page{margin:1.2cm;size:A4}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #dc2626;padding-bottom:16px;margin-bottom:20px}
.header h1{font-size:19px;font-weight:700;color:#dc2626;letter-spacing:-.3px}
.header .sub{font-size:10px;color:#6b7280;margin-top:4px}
.header-right{text-align:right;font-size:10px;color:#6b7280;line-height:1.6}
.header-right .isp{font-size:14px;font-weight:700;color:#111827}
.meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
.meta-card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:11px 13px}
.meta-card .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:3px}
.meta-card .val{font-size:11.5px;font-weight:600;color:#111827}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.sc{border:1px solid #e5e7eb;border-radius:7px;padding:13px;text-align:center}
.sc.danger{border-color:#fecaca;background:#fef2f2}
.sc.warning{border-color:#fde68a;background:#fffbeb}
.sc.ok{border-color:#bbf7d0;background:#f0fdf4}
.sc.neutral{border-color:#e5e7eb;background:#f9fafb}
.sv{font-size:26px;font-weight:700;line-height:1;margin-bottom:5px}
.sc.danger .sv{color:#dc2626}.sc.warning .sv{color:#d97706}.sc.ok .sv{color:#16a34a}.sc.neutral .sv{color:#374151}
.sl{font-size:9.5px;color:#6b7280;font-weight:500}
.extra-row{display:flex;gap:10px;margin-bottom:20px}
.extra-item{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 13px}
.extra-label{font-size:9px;color:#9ca3af;font-weight:700;text-transform:uppercase;margin-bottom:3px}
.extra-value{font-size:12px;font-weight:600;color:#111827}
.sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#374151;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid #e5e7eb}
table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:6px}
thead tr{background:#dc2626;color:#fff}
th{padding:7px 9px;text-align:left;font-weight:600;font-size:9.5px;white-space:nowrap}
tbody tr:nth-child(even){background:#fef7f7}
tbody tr:nth-child(odd){background:#fff}
td{padding:5.5px 9px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
.td-danger{color:#dc2626;font-weight:600}
.td-ok{color:#16a34a;font-weight:600}
.footer{margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;display:flex;justify-content:space-between}
tr{page-break-inside:avoid}
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>⚠ Dossiê de Evidências</h1>
    <div class="sub">Violações de Contrato de Internet · Network Connection Monitor</div>
  </div>
  <div class="header-right">
    <div class="isp">${h(ispName)}</div>
    <div>Plano contratado: <strong>${contracted > 0 ? contracted + " Mbps" : "não configurado"}</strong></div>
    <div>Gerado em: ${h(now.toLocaleString("pt-BR"))}</div>
  </div>
</div>

<div class="meta-grid">
  <div class="meta-card">
    <div class="lbl">Período Analisado</div>
    <div class="val">${h(firstDay)} a ${h(lastDay)} (${days} dias)</div>
  </div>
  <div class="meta-card">
    <div class="lbl">Mínimo Exigido ANATEL</div>
    <div class="val">${contracted > 0 ? `🔌 Cabo: ${wiredThreshold.toFixed(0)} Mbps (40%)<br>📶 WiFi: ${wifiThreshold.toFixed(0)} Mbps (30%)` : h(threshLabel)}</div>
  </div>
  <div class="meta-card">
    <div class="lbl">Base Legal</div>
    <div class="val">Resolução ANATEL nº 614/2013</div>
  </div>
</div>

<div class="stats-grid">
  <div class="sc neutral">
    <div class="sv">${stats.total}</div>
    <div class="sl">Testes realizados</div>
  </div>
  <div class="sc danger">
    <div class="sv">${stats.violations}</div>
    <div class="sl">Violações ANATEL</div>
  </div>
  <div class="sc ${Number(violPct) >= 30 ? "danger" : Number(violPct) >= 10 ? "warning" : "ok"}">
    <div class="sv">${violPct}%</div>
    <div class="sl">Taxa de violação</div>
  </div>
  <div class="sc ${stats.violation_days > 0 ? "danger" : "ok"}">
    <div class="sv">${stats.violation_days}</div>
    <div class="sl">Dias afetados de ${stats.total_days}</div>
  </div>
</div>

<div class="extra-row">
  <div class="extra-item">
    <div class="extra-label">Download médio no período</div>
    <div class="extra-value">${stats.avg_download.toFixed(1)} Mbps${h(avgPct)}</div>
  </div>
  <div class="extra-item">
    <div class="extra-label">Ping médio</div>
    <div class="extra-value">${stats.avg_ping.toFixed(0)} ms</div>
  </div>
  <div class="extra-item">
    <div class="extra-label">Horário com maior lentidão</div>
    <div class="extra-value">${h(worstHourLabel)}</div>
  </div>
  ${packetLossCell}
</div>

<div class="sec">Resumo por Dia</div>
<table>
  <thead><tr>
    <th>Data</th><th>Tipo / Rede</th><th style="text-align:center">Testes</th>
    <th style="text-align:center">Violações</th><th style="text-align:center">Taxa</th>
    <th>Download Mín.</th><th>Download Méd.</th><th>Upload Méd.</th>
  </tr></thead>
  <tbody>${dailyRowsHtml}</tbody>
</table>

<div class="sec" style="page-break-before:always">Medições Abaixo do Mínimo ANATEL</div>
<table>
  <thead><tr>
    <th>Data / Hora</th><th>Download</th><th>% do Plano</th>
    <th>Upload</th><th>Ping</th><th>Jitter</th><th>Pac. Loss</th>
    <th>Tipo</th><th>Servidor</th><th>Verificação Ookla</th>
  </tr></thead>
  <tbody>${violRowsHtml}</tbody>
</table>

<div class="footer">
  <span>Conexão Flow · ${h(now.toLocaleString("pt-BR"))}</span>
  <span>Documento para reclamações na ANATEL (anatel.gov.br/consumidor) e PROCON</span>
</div>

</body>
</html>`;

      const tmpPath = join(tmpdir(), `evidence-${Date.now()}.html`);
      fs.writeFileSync(tmpPath, html, "utf8");

      const hiddenWin = new BrowserWindow({
        show: false,
        webPreferences: { contextIsolation: true, javascript: false },
      });

      try {
        await hiddenWin.loadFile(tmpPath);
        const pdfBuffer = await hiddenWin.webContents.printToPDF({
          printBackground: true,
          pageSize: "A4",
          margins: {
            marginType: "custom",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          },
        });

        const safeName = ispName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
        const defaultPath = `dossie-evidencias-${safeName}-${now.toISOString().split("T")[0]}.pdf`;

        const { filePath } = await dialog.showSaveDialog(win ?? undefined, {
          defaultPath,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (filePath) {
          fs.writeFileSync(filePath, pdfBuffer);
          return { ok: true, count: violations.length };
        }
        return { ok: false, count: 0 };
      } finally {
        hiddenWin.destroy();
        fs.rmSync(tmpPath, { force: true });
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.AUTOSTART_GET, () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle(IPC_CHANNELS.AUTOSTART_SET, (_event, enable: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enable });
    return { ok: true };
  });
}
