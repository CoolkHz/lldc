"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { fetchJson } from "@/lib/client/fetch-json"
import { formatTaipei } from "@/lib/lottery/format"
import { statusBadgeVariant, statusLabel } from "@/lib/lottery/status"
import { getCurrentDrawId } from "@/lib/lottery/time"

type DashboardResponse = {
  drawId: string
  nowTs: number
  draw: {
    drawId: string
    status: string
    salesStartTs: number
    salesEndTs: number
    winning: string | null
    carryOverPoints: number
  }
  pool: {
    grossPoints: number
    linuxdoFeePoints: number
    netPoints: number
    operatorFeePoints: number
    p1Points: number
    p2Points: number
    p3Points: number
  }
}

type ParticipantsResponse = {
  items: Array<{
    linuxdoUserId: string
    nickname: string
    avatarUrl: string
    ticketCount: number
  }>
  limit: number
  cursor: number
  nextCursor: number | null
}

function nicknameFallback(nickname: string): string {
  const trimmed = nickname.trim()
  if (!trimmed) return "LD"
  return trimmed.slice(0, 2).toUpperCase()
}

export function LotteryDashboard() {
  const [ticketCount, setTicketCount] = React.useState<number>(1)
  const [submitting, setSubmitting] = React.useState(false)

  const [dashboard, setDashboard] = React.useState<DashboardResponse | null>(null)
  const [participants, setParticipants] = React.useState<ParticipantsResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const refreshAll = React.useCallback(() => {
    const ac = new AbortController()
    setError(null)
    void (async () => {
      try {
        const drawId = getCurrentDrawId()
        const d = await fetchJson<DashboardResponse>(`/api/lottery/dashboard?drawId=${encodeURIComponent(drawId)}`, ac.signal)
        setDashboard(d)
        const dashboardDrawId = d.drawId
        const participantsList = await fetchJson<ParticipantsResponse>(
          `/api/lottery/draws/${encodeURIComponent(dashboardDrawId)}/participants?limit=50&cursor=0`,
          ac.signal,
        )
        setParticipants(participantsList)
      } catch (e) {
        if (ac.signal.aborted) return
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => ac.abort()
  }, [])

  React.useEffect(() => {
    const cleanup = refreshAll()
    return cleanup
  }, [refreshAll])

  async function submitOrder() {
    const count = Math.trunc(ticketCount)
    if (!Number.isFinite(count) || count <= 0) {
      setError("注数必须为正整数")
      return
    }
    if (count > 200) {
      setError("注数过大（最大 200）")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/lottery/orders", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketCount: count }),
      })
      if (res.status === 401) {
        window.location.replace("/login")
        return
      }
      const html = await res.text()
      if (!res.ok) {
        setError(html.slice(0, 500) || `HTTP ${res.status}`)
        return
      }

      // 下注接口返回 auto-submit HTML；直接替换当前文档，交由 LinuxDO Credit 跳转支付。
      document.open()
      document.write(html)
      document.close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">抽奖面板</h2>
        {dashboard ? (
          <Badge variant={statusBadgeVariant(dashboard.draw.status)}>
            {dashboard.drawId} · {statusLabel(dashboard.draw.status)}
          </Badge>
        ) : (
          <Skeleton className="h-6 w-40" />
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={refreshAll}>
            刷新
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>加载失败</CardTitle>
            <CardDescription className="break-words">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>本期信息</CardTitle>
            <CardDescription>台北时间 08:00 开奖</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard ? (
              <>
                <div className="text-sm">
                  <div className="text-muted-foreground">销售窗口（台北）</div>
                  <div className="font-medium">
                    {formatTaipei(dashboard.draw.salesStartTs)} ~ {formatTaipei(dashboard.draw.salesEndTs)}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">开奖号码</div>
                  <div className="font-mono font-semibold">{dashboard.draw.winning ?? "未开奖"}</div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">累计滚存</div>
                  <div className="font-medium">{dashboard.draw.carryOverPoints} 积分</div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>奖池分配</CardTitle>
            <CardDescription>金额单位：积分（全整数）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">总额</span>
                  <span className="font-medium">{dashboard.pool.grossPoints}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">平台费</span>
                  <span className="font-medium">{dashboard.pool.linuxdoFeePoints}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">净额</span>
                  <span className="font-medium">{dashboard.pool.netPoints}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">运营费（5%）</span>
                  <span className="font-medium">{dashboard.pool.operatorFeePoints}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">一等奖池（80%）</span>
                  <span className="font-medium">{dashboard.pool.p1Points}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">二等奖池（10%）</span>
                  <span className="font-medium">{dashboard.pool.p2Points}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">三等奖池（5%）</span>
                  <span className="font-medium">{dashboard.pool.p3Points}</span>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>下注</CardTitle>
            <CardDescription>每注 10 积分，4 位数字号码（0000-9999）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ticketCount">注数</Label>
              <Input
                id="ticketCount"
                inputMode="numeric"
                value={String(ticketCount)}
                onChange={(e) => setTicketCount(Number(e.target.value))}
              />
              <div className="text-muted-foreground text-xs">
                号码默认随机生成；支付成功后回调才会确认下注并生成彩票。
              </div>
            </div>
            <Button className="w-full" onClick={submitOrder} disabled={submitting}>
              {submitting ? "正在生成支付单..." : "去支付"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>本期参与者（按注数排序）</CardTitle>
          <CardDescription>仅统计已支付订单的快照昵称与头像</CardDescription>
        </CardHeader>
        <CardContent>
          {participants ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>注数</TableHead>
                  <TableHead>用户ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.items.length ? (
                  participants.items.map((p) => (
                    <TableRow key={`${p.linuxdoUserId}:${p.nickname}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarImage src={p.avatarUrl} alt={p.nickname} />
                            <AvatarFallback>{nicknameFallback(p.nickname)}</AvatarFallback>
                          </Avatar>
                          <span className="max-w-[220px] truncate">{p.nickname}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{p.ticketCount}</TableCell>
                      <TableCell className="font-mono text-xs">{p.linuxdoUserId}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      暂无参与者
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
