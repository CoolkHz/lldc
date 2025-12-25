"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SiteHeader } from "@/components/site-header"
import { fetchJson } from "@/lib/client/fetch-json"
import { formatTaipei } from "@/lib/lottery/format"

type MyOrdersResponse = {
  items: Array<{
    outTradeNo: string
    drawId: string
    ticketCount: number
    moneyPoints: number
    status: "pending" | "paid"
    bonusPoints: number
    createdAt: number
    paidAt: number | null
  }>
  limit: number
  cursor: number
  nextCursor: number | null
}

const columns: Array<ColumnDef<MyOrdersResponse["items"][number], unknown>> = [
  {
    id: "订单号",
    accessorKey: "outTradeNo",
    header: "订单号",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.outTradeNo}</span>,
  },
  {
    id: "期号",
    accessorKey: "drawId",
    header: "期号",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.drawId}</span>,
  },
  {
    id: "注数",
    accessorKey: "ticketCount",
    header: "注数",
    cell: ({ row }) => row.original.ticketCount,
  },
  {
    id: "金额",
    accessorKey: "moneyPoints",
    header: "金额",
    cell: ({ row }) => row.original.moneyPoints,
  },
  {
    id: "状态",
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "paid" ? "default" : "outline"}>
        {row.original.status === "paid" ? "已支付" : "待支付"}
      </Badge>
    ),
  },
  {
    id: "奖金",
    accessorKey: "bonusPoints",
    header: "奖金",
    cell: ({ row }) => <span className="font-medium">{row.original.bonusPoints}</span>,
  },
  {
    id: "创建时间",
    accessorKey: "createdAt",
    header: "创建时间（台北）",
    cell: ({ row }) => <span className="text-xs">{formatTaipei(row.original.createdAt)}</span>,
  },
]

export default function Page() {
  const [data, setData] = React.useState<MyOrdersResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(() => {
    const ac = new AbortController()
    setError(null)
    void (async () => {
      try {
        const d = await fetchJson<MyOrdersResponse>("/api/lottery/me/orders?limit=20&cursor=0", ac.signal)
        setData(d)
      } catch (e) {
        setData(null)
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => ac.abort()
  }, [])

  React.useEffect(() => refresh(), [refresh])

  return (
    <>
      <SiteHeader title="我的订单" refreshHref="/dashboard/orders" />

      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              {error ? (
                <Card>
                  <CardHeader>
                    <CardTitle>加载失败</CardTitle>
                    <CardDescription className="break-words">{error}</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>我的订单</CardTitle>
                  <CardDescription>仅展示最近 20 笔</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  {data ? (
                    <DataTable data={data.items} columns={columns} emptyText="暂无订单" />
                  ) : (
                    <div className="space-y-2 px-6">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
