export interface SpeedResult {
  id: number
  tested_at: string
  download: number
  upload: number
  ping: number
  jitter: number | null
  server_host: string | null
  server_name: string | null
  is_slow: number
  network_name: string | null
  isp_name: string | null
  connection_type: 'wifi' | 'wired' | null
  packet_loss: number | null
  result_url: string | null
  network_id: number | null
}

export interface Settings {
  interval_minutes: string
  notifications_enabled: string
  active_network_id?: string
  active_network_manual_override?: string
  // Chaves legadas, ainda presentes no banco por retrocompatibilidade — não use
  slow_threshold_mbps?: string
  contracted_speed_mbps?: string
  connection_type?: string
  isp_name?: string
}

export interface LiveNetworkInfo {
  networkName: string
  ispName: string
  connectionType: 'wifi' | 'wired'
}

export interface Network {
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

export type NetworkUpdateInput = Partial<NetworkCreateInput>

export type LiveMatchStatus = 'match' | 'mismatch' | 'uncatalogued' | 'unknown'

export interface ActiveNetworkState {
  active: Network | null
  live: LiveNetworkInfo | null
  liveMatch: LiveMatchStatus
  manualOverride: boolean
}

export interface NetworkSuggestion {
  live: LiveNetworkInfo
  alreadyRegistered: boolean
  suggestion: {
    name: string
    ssid: string
    connection_type: 'wifi' | 'wired'
    isp_name: string
  }
}

export interface SpeedEvaluation {
  label: string
  detail: string
  percentage: number
  color: 'green' | 'yellow' | 'orange' | 'red'
  anatelRule: string | null
}

export interface HeatmapPoint {
  day: string
  hour: string
  avg_download: number
  min_download: number
  total: number
}

export interface DailyPoint {
  day_of_week: string
  avg_download: number
  avg_upload: number
  min_download: number
  total: number
  slow_count: number
}

export interface WeeklyPoint {
  day: string
  avg_download: number
  min_download: number
  total: number
  slow_count: number
}

export interface HistoryResponse {
  rows: SpeedResult[]
  total: number
  page: number
  limit: number
}

export interface InstabilityHour {
  hour: string
  total: number
  slow_count: number
  avg_download: number
  slow_pct: number
}

export interface InstabilityDay {
  day: string
  total: number
  slow_count: number
}

export interface ConnectionPoint {
  connection_type: string | null
  avg_download: number
  total: number
}

export interface DailyHourSlot {
  day: string
  hour: string
  avg_download: number
  min_download: number
  max_download: number
  total: number
  slow_count: number
}

export interface DailyInterval {
  day: string
  startHour: string
  endHour: string
  avgDownload: number
  minDownload: number
  maxDownload: number
  slowCount: number
  totalTests: number
}

export interface InstabilityData {
  slowDays: InstabilityDay[]
  connectionComparison: ConnectionPoint[]
  dailyHourly: DailyHourSlot[]
  totalSlowDays: number
  anatelThreshold: number
}
