type KvTtl = { ttlSeconds: number }

export async function getJson<T>(kv: KVNamespace, key: string): Promise<T | undefined> {
  const value = await kv.get<T>(key, { type: "json" })
  return value ?? undefined
}

export async function setJson(kv: KVNamespace, key: string, value: unknown, options: KvTtl) {
  await kv.put(key, JSON.stringify(value), { expirationTtl: options.ttlSeconds })
}

export async function del(kv: KVNamespace, key: string) {
  await kv.delete(key)
}

export function dashboardKey(cacheVersion: string, drawId: string) {
  return `lottery:${cacheVersion}:dashboard:${drawId}`
}

export function poolKey(cacheVersion: string, drawId: string) {
  return `lottery:${cacheVersion}:pool:${drawId}`
}

export function drawsListKey(cacheVersion: string, limit: number, cursorOr0: number) {
  return `lottery:${cacheVersion}:draws:list:${limit}:${cursorOr0}`
}

export function drawDetailKey(cacheVersion: string, drawId: string) {
  return `lottery:${cacheVersion}:draw:${drawId}:detail`
}

export function participantsKey(cacheVersion: string, drawId: string, limit: number, cursorOr0: number) {
  return `lottery:${cacheVersion}:participants:${drawId}:${limit}:${cursorOr0}`
}

