export function formatTaipei(ts: number | null | undefined): string {
  if (!ts) return "-"
  return new Date(ts * 1000).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  })
}

