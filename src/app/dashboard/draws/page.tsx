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
import { statusBadgeVariant, statusLabel } from "@/lib/lottery/status"

type DrawsListResponse = {
  items: Array<{
    drawId: string
    status: string
    winning: string | null
    salesStartTs: number
    salesEndTs: number
    carryOverPoints: number
  }>
  limit: number
  cursor: number
  nextCursor: number | null
}

const columns: Array<ColumnDef<DrawsListResponse["items"][number], unknown>> = [
  {
    id: "期号",
    accessorKey: "drawId",
    header: "期号",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.drawId}</span>,
  },
  {
    id: "状态",
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{statusLabel(row.original.status)}</Badge>,
  },
  {
    id: "开奖号码",
    accessorKey: "winning",
    header: "开奖号码",
    cell: ({ row }) => <span className="font-mono font-semibold">{row.original.winning ?? "-"}</span>,
  },
  {
    id: "销售截止",
    accessorKey: "salesEndTs",
    header: "销售截止",
    cell: ({ row }) => <span className="text-xs">{formatTaipei(row.original.salesEndTs)}</span>,
  },
  {
    id: "滚存",
    accessorKey: "carryOverPoints",
    header: "滚存",
    cell: ({ row }) => <span className="font-medium">{row.original.carryOverPoints}</span>,
  },
]

export default function Page() {
  const [data, setData] = React.useState<DrawsListResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(() => {
    const ac = new AbortController()
    setError(null)
    void (async () => {
      try {
        const d = await fetchJson<DrawsListResponse>("/api/lottery/draws?limit=20&cursor=0", ac.signal)
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
      <SiteHeader title="往期开奖" refreshHref="/dashboard/draws" />

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

              <CardHeader>
                <CardTitle>往期开奖</CardTitle>
                <CardDescription>仅展示最近 20 期</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {data ? (
                  <DataTable data={data.items} columns={columns} emptyText="暂无开奖记录" />
                ) : (
                  <div className="space-y-2 px-6">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                )}
              </CardContent>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
