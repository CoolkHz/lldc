type Env = {
  TARGET_WORKER: Fetcher
  DRAW_RUN_TOKEN: string
}

async function callRunDraw(env: Env) {
  const req = new Request("https://internal/api/draw/run", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.DRAW_RUN_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  })

  return await env.TARGET_WORKER.fetch(req)
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const res = await callRunDraw(env)
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          console.error("draw/run failed", res.status, text)
        }
      })(),
    )
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (req.method === "POST" && url.pathname === "/run") {
      const res = await callRunDraw(env)
      return new Response(await res.text(), { status: res.status, headers: res.headers })
    }
    return new Response("Not Found", { status: 404 })
  },
}

