import { useEffect } from 'react'
import { ipc } from '../lib/ipc'
import { useSpeedStore } from '../store/speedStore'
import type { Settings } from '../types'

export function useSettings(): {
  settings: Settings
  saveSettings: (s: Partial<Settings>) => Promise<void>
} {
  const { settings, setSettings } = useSpeedStore()

  useEffect(() => {
    ipc.getSettings().then(setSettings).catch(() => {})
  }, [])

  const saveSettings = async (s: Partial<Settings>): Promise<void> => {
    await ipc.setSettings(s)
    const updated = await ipc.getSettings()
    setSettings(updated)
  }

  return { settings, saveSettings }
}
