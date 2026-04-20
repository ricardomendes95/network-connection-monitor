import { Notification } from 'electron'

export function showSlowNetworkNotification(downloadMbps: number): void {
  try {
    if (!Notification.isSupported()) return
    new Notification({
      title: 'Rede Lenta Detectada',
      body: `Velocidade atual: ${downloadMbps.toFixed(1)} Mbps — abaixo do limite configurado.`,
      urgency: 'critical'
    }).show()
  } catch {
    // Falha silenciosa em ambientes sem suporte a notificações (WSL)
  }
}
