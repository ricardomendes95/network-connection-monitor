import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import { getDb } from '../database/connection'
import { IPC_CHANNELS } from './channels'
import { getNetworkInfo } from '../services/network-info.service'
import type { SchedulerService } from '../services/scheduler.service'

export function registerHandlers(scheduler: SchedulerService): void {
  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, (_event, filter: { days?: number; page?: number; limit?: number } = {}) => {
    const db = getDb()
    const days = filter.days ?? 7
    const limit = filter.limit ?? 50
    const offset = ((filter.page ?? 1) - 1) * limit

    const rows = db.prepare(`
      SELECT * FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
      ORDER BY tested_at DESC
      LIMIT ? OFFSET ?
    `).all(days, limit, offset)

    const total = (db.prepare(`
      SELECT COUNT(*) as count FROM speed_results
      WHERE tested_at >= datetime('now', '-' || ? || ' days')
    `).get(days) as { count: number }).count

    return { rows, total, page: filter.page ?? 1, limit }
  })

  ipcMain.handle(IPC_CHANNELS.GET_CHART_DATA, (_event, type: 'heatmap' | 'daily' | 'timeline' | 'weekly' | 'instability', days = 7, options?: { contracted_mbps?: number; connection_type?: string }) => {
    const db = getDb()

    if (type === 'heatmap') {
      return db.prepare(`
        SELECT strftime('%w', tested_at) AS day,
               strftime('%H', tested_at) AS hour,
               AVG(download) AS avg_download,
               MIN(download) AS min_download,
               COUNT(*) AS total
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day, hour
        ORDER BY day, hour
      `).all(days)
    }

    if (type === 'daily') {
      return db.prepare(`
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
      `).all(days)
    }

    if (type === 'timeline') {
      return db.prepare(`
        SELECT tested_at, download, upload, ping, is_slow
        FROM speed_results
        WHERE date(tested_at) = date('now')
        ORDER BY tested_at ASC
      `).all()
    }

    if (type === 'weekly') {
      return db.prepare(`
        SELECT date(tested_at) AS day,
               AVG(download) AS avg_download,
               MIN(download) AS min_download,
               COUNT(*) AS total,
               COUNT(CASE WHEN is_slow=1 THEN 1 END) AS slow_count
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day
        ORDER BY day ASC
      `).all(days)
    }

    if (type === 'instability') {
      const contracted = options?.contracted_mbps ?? 0
      const connType = options?.connection_type ?? 'auto'

      // Threshold ANATEL: cabo 40%, WiFi 30%; fallback = slow_threshold_mbps da settings
      let anatelThreshold = 0
      if (contracted > 0) {
        anatelThreshold = connType === 'wifi' ? contracted * 0.30 : contracted * 0.40
      }

      // Se não tiver velocidade contratada configurada, usa o threshold salvo nas settings
      if (anatelThreshold <= 0) {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'slow_threshold_mbps'").get() as { value: string } | undefined
        anatelThreshold = Number(row?.value ?? 10)
      }

      // Todos os dias medidos no período, contando quedas pelo threshold ANATEL
      const slowDays = db.prepare(`
        SELECT date(tested_at) AS day,
               COUNT(*) AS total,
               COUNT(CASE WHEN download < ? THEN 1 END) AS slow_count
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY day
        ORDER BY day DESC
      `).all(anatelThreshold, days)

      const connectionComparison = db.prepare(`
        SELECT connection_type,
               AVG(download) AS avg_download,
               COUNT(*) AS total
        FROM speed_results
        WHERE tested_at >= datetime('now', '-' || ? || ' days')
        GROUP BY connection_type
      `).all(days)

      // Por dia + hora com instabilidade (avg abaixo do threshold ANATEL)
      const dailyHourly = db.prepare(`
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
      `).all(anatelThreshold, days, anatelThreshold, anatelThreshold)

      const totalSlowDays = (slowDays as { slow_count: number }[]).filter((d) => d.slow_count > 0).length

      return {
        slowDays,
        connectionComparison,
        dailyHourly,
        totalSlowDays,
        anatelThreshold
      }
    }

    return []
  })

  ipcMain.handle(IPC_CHANNELS.RUN_NOW, async () => {
    scheduler.updateInterval(scheduler['intervalMs'] / 60000)
    return { queued: true }
  })

  ipcMain.handle(IPC_CHANNELS.GET_NETWORK_INFO, async () => {
    return await getNetworkInfo()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Record<string, string>) => {
    const db = getDb()
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const upsertMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) upsert.run(key, value)
    })
    upsertMany(Object.entries(settings))

    if (settings.interval_minutes) {
      scheduler.updateInterval(Number(settings.interval_minutes))
    }
    if (settings.slow_threshold_mbps) {
      scheduler.updateThreshold(Number(settings.slow_threshold_mbps))
    }
    if (settings.connection_type) {
      scheduler.updateConnectionType(settings.connection_type)
    }

    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false }

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: true
    })

    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: `relatorio-rede-${new Date().toISOString().split('T')[0]}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (filePath) {
      fs.writeFileSync(filePath, pdfBuffer)
      return { ok: true }
    }
    return { ok: false }
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_PNG, async (event, dataUrl: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    const { filePath } = await dialog.showSaveDialog(win ?? undefined, {
      defaultPath: `relatorio-rede-${new Date().toISOString().split('T')[0]}.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })

    if (filePath) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
      return { ok: true }
    }
    return { ok: false }
  })
}
