export function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "drawn") return "default"
  if (status === "closing") return "secondary"
  if (status === "open") return "outline"
  return "secondary"
}

export function statusLabel(status: string): string {
  if (status === "open") return "销售中"
  if (status === "closing") return "开奖中"
  if (status === "drawn") return "已开奖"
  return status
}

