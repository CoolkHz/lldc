const TAIPEI_TZ = "Asia/Taipei"
const TAIPEI_UTC_OFFSET_HOURS = 8

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const dateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TAIPEI_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function getTaipeiParts(date: Date): DateParts {
  const parts = dateTimeFormat.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0")
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export function formatDrawIdYmd(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

function taipeiLocalToUtcSeconds(parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour - TAIPEI_UTC_OFFSET_HOURS, parts.minute, parts.second) / 1000,
  )
}

function addDaysYmd(ymd: { year: number; month: number; day: number }, deltaDays: number) {
  const utc = Date.UTC(ymd.year, ymd.month - 1, ymd.day + deltaDays, 0, 0, 0)
  const d = new Date(utc)
  const p = getTaipeiParts(d)
  return { year: p.year, month: p.month, day: p.day }
}

export function getCurrentDrawId(now = new Date()): string {
  const p = getTaipeiParts(now)
  const base = { year: p.year, month: p.month, day: p.day }
  const ymd = p.hour < 8 ? base : addDaysYmd(base, 1)
  return formatDrawIdYmd(ymd)
}

export function getDueDrawId(now = new Date()): string {
  const p = getTaipeiParts(now)
  const base = { year: p.year, month: p.month, day: p.day }
  const ymd = p.hour >= 8 ? base : addDaysYmd(base, -1)
  return formatDrawIdYmd(ymd)
}

export function getSalesWindowUtcSeconds(drawId: string): { salesStartTs: number; salesEndTs: number } {
  const [year, month, day] = drawId.split("-").map((s) => Number(s))
  const startLocal = { year, month, day: day - 1, hour: 8, minute: 0, second: 0 }
  const endLocal = { year, month, day, hour: 7, minute: 59, second: 59 }

  // 注意：北京无夏令时，固定 UTC+8；这里以固定偏移换算到 UTC 秒。
  return {
    salesStartTs: taipeiLocalToUtcSeconds(startLocal),
    salesEndTs: taipeiLocalToUtcSeconds(endLocal),
  }
}

export function getPrevDrawId(drawId: string): string {
  const [year, month, day] = drawId.split("-").map((s) => Number(s))
  return formatDrawIdYmd(addDaysYmd({ year, month, day }, -1))
}

export function getNextDrawId(drawId: string): string {
  const [year, month, day] = drawId.split("-").map((s) => Number(s))
  return formatDrawIdYmd(addDaysYmd({ year, month, day }, 1))
}

