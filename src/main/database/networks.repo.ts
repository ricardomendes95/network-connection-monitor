import { getDb } from './connection'

export interface NetworkRecord {
  id: number
  name: string
  ssid: string
  connection_type: 'wifi' | 'wired'
  isp_name: string
  contracted_speed_mbps: number
  slow_threshold_mbps: number
  created_at: string
  updated_at: string
}

export interface NetworkCreateInput {
  name: string
  ssid: string
  connection_type: 'wifi' | 'wired'
  isp_name?: string
  contracted_speed_mbps?: number
  slow_threshold_mbps?: number
}

export type NetworkUpdateInput = Partial<Omit<NetworkCreateInput, 'connection_type'>> & {
  connection_type?: 'wifi' | 'wired'
}

export const networksRepo = {
  list(): NetworkRecord[] {
    return getDb()
      .prepare('SELECT * FROM networks ORDER BY name COLLATE NOCASE ASC')
      .all() as NetworkRecord[]
  },

  getById(id: number): NetworkRecord | null {
    const row = getDb().prepare('SELECT * FROM networks WHERE id = ?').get(id)
    return (row as NetworkRecord | undefined) ?? null
  },

  getByIdentity(ssid: string, connectionType: 'wifi' | 'wired'): NetworkRecord | null {
    const row = getDb()
      .prepare('SELECT * FROM networks WHERE ssid = ? AND connection_type = ?')
      .get(ssid, connectionType)
    return (row as NetworkRecord | undefined) ?? null
  },

  create(input: NetworkCreateInput): NetworkRecord {
    const now = new Date().toISOString()
    const info = getDb()
      .prepare(
        `INSERT INTO networks
          (name, ssid, connection_type, isp_name, contracted_speed_mbps, slow_threshold_mbps, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name.trim(),
        input.ssid.trim(),
        input.connection_type,
        (input.isp_name ?? '').trim(),
        input.contracted_speed_mbps ?? 100,
        input.slow_threshold_mbps ?? 10,
        now,
        now
      )
    const created = this.getById(Number(info.lastInsertRowid))
    if (!created) throw new Error('Falha ao criar rede')
    return created
  },

  update(id: number, patch: NetworkUpdateInput): NetworkRecord {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Rede ${id} não encontrada`)
    const merged: NetworkRecord = {
      ...existing,
      ...patch,
      name: (patch.name ?? existing.name).trim(),
      ssid: (patch.ssid ?? existing.ssid).trim(),
      isp_name: (patch.isp_name ?? existing.isp_name).trim(),
      contracted_speed_mbps: patch.contracted_speed_mbps ?? existing.contracted_speed_mbps,
      slow_threshold_mbps: patch.slow_threshold_mbps ?? existing.slow_threshold_mbps,
      connection_type: patch.connection_type ?? existing.connection_type,
      updated_at: new Date().toISOString()
    }
    getDb()
      .prepare(
        `UPDATE networks
           SET name = ?, ssid = ?, connection_type = ?, isp_name = ?,
               contracted_speed_mbps = ?, slow_threshold_mbps = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        merged.name,
        merged.ssid,
        merged.connection_type,
        merged.isp_name,
        merged.contracted_speed_mbps,
        merged.slow_threshold_mbps,
        merged.updated_at,
        id
      )
    return merged
  },

  remove(id: number): void {
    const db = getDb()
    const tx = db.transaction(() => {
      db.prepare('UPDATE speed_results SET network_id = NULL WHERE network_id = ?').run(id)
      db.prepare('DELETE FROM networks WHERE id = ?').run(id)
    })
    tx()
  }
}
