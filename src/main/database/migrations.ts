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
    INSERT OR IGNORE INTO settings VALUES ('active_network_manual_override', 'false');

    CREATE TABLE IF NOT EXISTS networks (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      name                  TEXT    NOT NULL,
      ssid                  TEXT    NOT NULL,
      connection_type       TEXT    NOT NULL,
      isp_name              TEXT    NOT NULL DEFAULT '',
      contracted_speed_mbps INTEGER NOT NULL DEFAULT 100,
      slow_threshold_mbps   INTEGER NOT NULL DEFAULT 10,
      created_at            TEXT    NOT NULL,
      updated_at            TEXT    NOT NULL,
      UNIQUE (ssid, connection_type)
    );

    CREATE INDEX IF NOT EXISTS idx_networks_ssid_type
      ON networks (ssid, connection_type);
  `)

  // Adiciona colunas em speed_results se o banco for pré-existente
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
  addIfMissing('network_id', 'network_id INTEGER REFERENCES networks(id)')

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_speed_results_network_id ON speed_results (network_id)'
  )

  backfillNetworks(db)
}

type Db = ReturnType<typeof getDb>

function backfillNetworks(db: Db): void {
  const networksCount = (
    db.prepare('SELECT COUNT(*) AS c FROM networks').get() as { c: number }
  ).c

  interface DistinctRow {
    network_name: string | null
    connection_type: string | null
  }

  const rows = db
    .prepare(
      `
      SELECT DISTINCT
        COALESCE(NULLIF(TRIM(network_name), ''), 'Rede sem nome') AS network_name,
        COALESCE(connection_type, 'wired') AS connection_type
      FROM speed_results
      WHERE network_id IS NULL
    `
    )
    .all() as DistinctRow[]

  if (rows.length === 0 && networksCount === 0) {
    return
  }

  const getSetting = (key: string, fallback: string): string => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? fallback
  }

  const legacyIsp = getSetting('isp_name', '')
  const legacyContracted = Number(getSetting('contracted_speed_mbps', '100')) || 100
  const legacyThreshold = Number(getSetting('slow_threshold_mbps', '10')) || 10

  const now = new Date().toISOString()
  const insertNetwork = db.prepare(
    `INSERT OR IGNORE INTO networks
      (name, ssid, connection_type, isp_name, contracted_speed_mbps, slow_threshold_mbps, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const selectByIdentity = db.prepare(
    'SELECT id FROM networks WHERE ssid = ? AND connection_type = ?'
  )
  const updateResults = db.prepare(
    `UPDATE speed_results
       SET network_id = ?
     WHERE network_id IS NULL
       AND COALESCE(NULLIF(TRIM(network_name), ''), 'Rede sem nome') = ?
       AND COALESCE(connection_type, 'wired') = ?`
  )

  const tx = db.transaction(() => {
    let firstNetworkId: number | null = null

    rows.forEach((row, index) => {
      const ssid = row.network_name ?? 'Rede sem nome'
      const type = row.connection_type === 'wifi' ? 'wifi' : 'wired'
      const isFirst = index === 0 && networksCount === 0

      insertNetwork.run(
        ssid,
        ssid,
        type,
        isFirst ? legacyIsp : '',
        isFirst ? legacyContracted : 100,
        isFirst ? legacyThreshold : 10,
        now,
        now
      )

      const existing = selectByIdentity.get(ssid, type) as { id: number } | undefined
      if (!existing) return

      if (firstNetworkId === null) firstNetworkId = existing.id

      updateResults.run(existing.id, ssid, type)
    })

    if (firstNetworkId !== null) {
      const activeRow = db
        .prepare("SELECT value FROM settings WHERE key = 'active_network_id'")
        .get() as { value: string } | undefined
      if (!activeRow) {
        db.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_network_id', ?)"
        ).run(String(firstNetworkId))
      }
    }
  })

  tx()
}
