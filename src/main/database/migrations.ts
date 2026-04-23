import { getDb } from './connection'

export function runMigrations(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS speed_results (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      tested_at       TEXT    NOT NULL,
      download        REAL    NOT NULL,
      upload          REAL    NOT NULL,
      ping            REAL    NOT NULL,
      jitter          REAL,
      server_host     TEXT,
      is_slow         INTEGER NOT NULL DEFAULT 0,
      network_name    TEXT,
      isp_name        TEXT,
      connection_type TEXT    DEFAULT 'wired'
    );

    CREATE INDEX IF NOT EXISTS idx_tested_at
      ON speed_results(tested_at);
    CREATE INDEX IF NOT EXISTS idx_hour
      ON speed_results(strftime('%H', tested_at));
    CREATE INDEX IF NOT EXISTS idx_day_of_week
      ON speed_results(strftime('%w', tested_at));
    CREATE INDEX IF NOT EXISTS idx_is_slow
      ON speed_results(is_slow);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings VALUES ('interval_minutes', '15');
    INSERT OR IGNORE INTO settings VALUES ('slow_threshold_mbps', '10');
    INSERT OR IGNORE INTO settings VALUES ('notifications_enabled', 'true');
    INSERT OR IGNORE INTO settings VALUES ('contracted_speed_mbps', '100');
    INSERT OR IGNORE INTO settings VALUES ('connection_type', 'auto');
    INSERT OR IGNORE INTO settings VALUES ('isp_name', '');
  `)

  // Migração segura: adiciona colunas se não existirem (banco já existente)
  const existingCols = (
    db.prepare("SELECT name FROM pragma_table_info('speed_results')").all() as { name: string }[]
  ).map((r) => r.name)

  const addIfMissing = (col: string, definition: string): void => {
    if (!existingCols.includes(col)) {
      db.exec(`ALTER TABLE speed_results ADD COLUMN ${definition}`)
    }
  }

  addIfMissing('network_name', 'network_name TEXT')
  addIfMissing('isp_name', 'isp_name TEXT')
  addIfMissing('connection_type', "connection_type TEXT DEFAULT 'wired'")
  addIfMissing('packet_loss', 'packet_loss REAL')
  addIfMissing('result_url', 'result_url TEXT')
  addIfMissing('server_name', 'server_name TEXT')
}
