import { Notification } from 'electron'

function notify(title: string, body: string): void {
  try {
    if (!Notification.isSupported()) return
    new Notification({ title, body, urgency: 'critical' }).show()
  } catch {
    // Falha silenciosa em ambientes sem suporte a notificações (WSL)
  }
}

export function showSlowNetworkNotification(downloadMbps: number): void {
  notify(
    'Rede Lenta Detectada',
    `Velocidade atual: ${downloadMbps.toFixed(1)} Mbps — abaixo do limite configurado.`
  )
}

export function showInternetDownNotification(): void {
  notify('Sem internet', 'A conexão caiu — o teste de velocidade falhou.')
}

export function showInternetRestoredNotification(downloadMbps: number): void {
  notify(
    'Internet voltou',
    `Conexão restaurada — velocidade atual: ${downloadMbps.toFixed(1)} Mbps.`
  )
}
