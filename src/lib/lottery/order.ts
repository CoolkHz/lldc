export const ORDER_EXPIRE_SECONDS = 10 * 60

export function isOrderExpired(createdAtUnixSeconds: number, nowUnixSeconds = Math.floor(Date.now() / 1000)) {
  return nowUnixSeconds - createdAtUnixSeconds >= ORDER_EXPIRE_SECONDS
}

export function getEffectiveOrderStatus(
  status: string,
  createdAtUnixSeconds: number,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
) {
  if (status !== "paid" && isOrderExpired(createdAtUnixSeconds, nowUnixSeconds)) return "canceled" as const
  if (status === "paid") return "paid" as const
  if (status === "canceled") return "canceled" as const
  return "pending" as const
}
