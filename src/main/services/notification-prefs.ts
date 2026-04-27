import { getDb } from "../database/connection";

type NotifPrefKey =
  | "notify_test_overlay"
  | "notify_internet_down"
  | "notify_internet_restored";

function readSetting(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function getNotifPref(key: NotifPrefKey): boolean {
  return readSetting(key) !== "false";
}

export function getOfflineIntervalSeconds(fallback = 30): number {
  const raw = readSetting("offline_interval_seconds");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
