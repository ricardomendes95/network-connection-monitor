import { execSync } from 'child_process'
import { net } from 'electron'
import os from 'os'
import fs from 'fs'

export interface NetworkInfo {
  networkName: string
  ispName: string
  connectionType: 'wifi' | 'wired'
}

let ispCache: { name: string; ts: number } | null = null

function isWSL(): boolean {
  try {
    return /microsoft|wsl/i.test(fs.readFileSync('/proc/version', 'utf8'))
  } catch {
    return false
  }
}

function isWindows(): boolean {
  return process.platform === 'win32'
}

function isMacOS(): boolean {
  return process.platform === 'darwin'
}

function runCmd(cmd: string, timeoutMs = 4000): string {
  try {
    return execSync(cmd, {
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8'
    }).trim()
  } catch {
    return ''
  }
}

interface WifiInfo {
  ssid: string | null
  connected: boolean
}

// Windows nativo ou WSL: consulta netsh para obter info do WiFi
function getWindowsWifiInfo(wsl = false): WifiInfo {
  const cmd = wsl ? 'netsh.exe wlan show interfaces' : 'netsh wlan show interfaces'
  const out = runCmd(cmd, 5000)
  if (!out) return { ssid: null, connected: false }

  let ssid: string | null = null
  let connected = false

  for (const raw of out.split('\n')) {
    // Remove \r de fim de linha (Windows CRLF) antes de qualquer regex com $
    const line = raw.replace(/\r$/, '')

    // Captura SSID mas não BSSID ("AP BSSID" começa com "AP ", não casa com /^\s+SSID/)
    // Sem âncora $ para evitar falha com \r residual
    const ssidMatch = line.match(/^\s+SSID\s*:\s*(.+)/)
    if (ssidMatch) {
      ssid = ssidMatch[1].trim()
    }
    // Estado em português ("Conectado") ou inglês ("Connected")
    if (/:\s*(Connected|Conectado)/i.test(line)) {
      connected = true
    }
  }

  return { ssid, connected }
}

// Windows nativo ou WSL: obtém nome do perfil de rede Ethernet ativa via PowerShell
function getWindowsEthernetProfileName(wsl = false): string {
  const ps = wsl ? 'powershell.exe' : 'powershell'
  const out = runCmd(
    `${ps} -NoProfile -Command "(Get-NetConnectionProfile | Where-Object {$_.IPv4Connectivity -ne 'NoTraffic'} | Select-Object -First 1).Name"`,
    6000
  )
  return out.replace(/\r/g, '') || 'Ethernet'
}

// Linux nativo: obtém SSID do WiFi
function getLinuxWifiInfo(): WifiInfo {
  const ssid = runCmd('iwgetid -r 2>/dev/null')
  if (ssid) return { ssid, connected: true }

  const out = runCmd('nmcli -t -f NAME,TYPE connection show --active 2>/dev/null')
  for (const line of out.split('\n')) {
    const [name, type] = line.split(':')
    if (/wireless|wifi/i.test(type ?? '')) {
      return { ssid: name, connected: true }
    }
  }

  return { ssid: null, connected: false }
}

function getNativeLinuxConnectionType(): 'wifi' | 'wired' {
  for (const name of Object.keys(os.networkInterfaces())) {
    if (/^(wl|wlan|wifi|ath|wlp)/i.test(name)) return 'wifi'
  }
  const out = runCmd('nmcli -t -f TYPE connection show --active 2>/dev/null')
  if (/wireless|wifi/i.test(out)) return 'wifi'
  return 'wired'
}

// macOS: interface padrão que tem rota para a internet
function getMacOSDefaultInterface(): string | null {
  const out = runCmd('route -n get default 2>/dev/null')
  if (!out) return null
  const match = out.match(/interface:\s*(\S+)/)
  return match ? match[1].trim() : null
}

// macOS: pares (serviceName, device) do `networksetup -listallhardwareports`
interface MacHardwarePort {
  service: string
  device: string
}

function getMacOSHardwarePorts(): MacHardwarePort[] {
  const out = runCmd('networksetup -listallhardwareports 2>/dev/null', 5000)
  if (!out) return []

  const ports: MacHardwarePort[] = []
  let current: Partial<MacHardwarePort> = {}
  for (const line of out.split('\n')) {
    const portMatch = line.match(/^Hardware Port:\s*(.+)$/)
    const deviceMatch = line.match(/^Device:\s*(.+)$/)
    if (portMatch) current = { service: portMatch[1].trim() }
    if (deviceMatch && current.service) {
      ports.push({ service: current.service, device: deviceMatch[1].trim() })
      current = {}
    }
  }
  return ports
}

function isMacOSWifiService(serviceName: string): boolean {
  return /wi-?fi|airport/i.test(serviceName)
}

// macOS: lê SSID do WiFi. Tenta networksetup (estável), depois ipconfig getsummary (fallback)
function getMacOSWifiInfo(wifiDevice: string): WifiInfo {
  const nsOut = runCmd(`networksetup -getairportnetwork ${wifiDevice} 2>/dev/null`)
  if (nsOut) {
    const match = nsOut.match(/Current Wi-Fi Network:\s*(.+)$/i)
    if (match) {
      const ssid = match[1].trim()
      if (ssid) return { ssid, connected: true }
    }
    if (/not associated|off|power/i.test(nsOut)) {
      return { ssid: null, connected: false }
    }
  }

  const summary = runCmd(`ipconfig getsummary ${wifiDevice} 2>/dev/null`)
  if (summary) {
    const match = summary.match(/\bSSID\s*:\s*([^\n]+)/)
    if (match) {
      const ssid = match[1].trim()
      if (ssid) return { ssid, connected: true }
    }
  }

  return { ssid: null, connected: false }
}

async function fetchIsp(): Promise<string> {
  // Usa net.fetch do Electron — respeita proxy do sistema e evita restrições do Node
  const apis: Array<{ url: string; extract: (d: Record<string, string>) => string | undefined }> = [
    {
      // ipinfo.io: campo "org" = "AS28126 BRISANET..." → remove prefixo ASN
      url: 'https://ipinfo.io/json',
      extract: (d) => d.org?.replace(/^AS\d+\s+/i, '').trim()
    },
    {
      url: 'https://ip-api.com/json?fields=isp,org',
      extract: (d) => d.isp || d.org
    },
    {
      url: 'https://ipapi.co/json/',
      extract: (d) => d.org
    }
  ]

  for (const api of apis) {
    try {
      const res = await net.fetch(api.url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) continue
      const data = (await res.json()) as Record<string, string>
      const isp = api.extract(data)
      if (isp && isp.length > 2) {
        ispCache = { name: isp, ts: Date.now() }
        return isp
      }
    } catch {
      // Tenta próxima API
    }
  }

  return ispCache?.name ?? 'Desconhecido'
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const wsl = isWSL()
  let networkName = 'Desconhecido'
  let connectionType: 'wifi' | 'wired' = 'wired'

  if (wsl || isWindows()) {
    // WSL ou Windows nativo: consulta via netsh/PowerShell
    const wifi = getWindowsWifiInfo(wsl)
    if (wifi.connected && wifi.ssid) {
      connectionType = 'wifi'
      networkName = wifi.ssid
    } else {
      connectionType = 'wired'
      networkName = getWindowsEthernetProfileName(wsl)
    }
  } else if (isMacOS()) {
    // macOS: resolve interface default → hardware port → SSID ou nome do serviço Ethernet
    const defaultInterface = getMacOSDefaultInterface()
    const ports = getMacOSHardwarePorts()
    const matchingPort = defaultInterface
      ? ports.find((p) => p.device === defaultInterface)
      : undefined

    if (matchingPort && isMacOSWifiService(matchingPort.service)) {
      connectionType = 'wifi'
      const wifi = getMacOSWifiInfo(matchingPort.device)
      networkName = wifi.ssid ?? 'WiFi'
    } else if (matchingPort) {
      connectionType = 'wired'
      networkName = matchingPort.service || 'Ethernet'
    } else {
      // Sem rota default identificada — tenta Wi-Fi em en0 como último recurso
      const wifi = getMacOSWifiInfo('en0')
      if (wifi.connected && wifi.ssid) {
        connectionType = 'wifi'
        networkName = wifi.ssid
      } else {
        connectionType = 'wired'
        networkName = 'Ethernet'
      }
    }
  } else {
    // Linux nativo
    connectionType = getNativeLinuxConnectionType()
    if (connectionType === 'wifi') {
      const wifi = getLinuxWifiInfo()
      networkName = wifi.ssid ?? 'WiFi'
    } else {
      const out = runCmd('nmcli -t -f NAME connection show --active 2>/dev/null')
      networkName = out.split('\n')[0] || 'Ethernet'
    }
  }

  // ISP com cache de 1 hora
  const ispName =
    ispCache && Date.now() - ispCache.ts < 3_600_000
      ? ispCache.name
      : await fetchIsp()

  return { networkName, ispName, connectionType }
}
