export interface SpeedResult {
  id: number
  tested_at: string
  download: number
  upload: number
  ping: number
  jitter: number | null
  server_host: string | null
  is_slow: number
  network_name: string | null
  isp_name: string | null
  connection_type: 'wifi' | 'wired' | null
}

export interface Settings {
  interval_minutes: string
  slow_threshold_mbps: string
  notifications_enabled: string
  contracted_speed_mbps: string
  connection_type: string
  isp_name: string
}

export interface LiveNetworkInfo {
  networkName: string
  ispName: string
  connectionType: 'wifi' | 'wired'
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
