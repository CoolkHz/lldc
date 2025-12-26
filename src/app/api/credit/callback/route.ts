import { NextResponse } from "next/server"

function buildRedirectResponse(req: Request) {
  const url = new URL(req.url)
  const target = new URL("/dashboard/orders", url.origin)
  const res = NextResponse.redirect(target, { status: 302 })
  res.headers.set("cache-control", "no-store")
  return res
}

export async function GET(req: Request) {
  return buildRedirectResponse(req)
}

export async function POST(req: Request) {
  return buildRedirectResponse(req)
}

