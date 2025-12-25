# lldcc (Next.js App Router + Cloudflare Workers / OpenNext)

本项目为 Next.js App Router 应用，运行在 Cloudflare Workers（OpenNext）。后端接口使用：

- Cloudflare D1（SQLite）+ Drizzle ORM
- Cloudflare KV（缓存）
- JWT（`jose`，HS256）
- Linux.do Credit epay（MD5 签名）

## 目录与分层（后端）

- `src/lib/env.ts`：`getEnv()` 统一获取 Cloudflare bindings + 配置（内部 `getCloudflareContext()`）
- `src/repositories/*`：数据访问层（Drizzle）
- `src/services/*`：业务层（下单、回调幂等、开奖、dashboard 聚合与缓存）
- `src/app/api/*`：HTTP API（所有 handler 首行调用 `getEnv()`）

## Cloudflare 绑定清单

必须绑定：

- D1：binding = `DB`
- KV：binding = `LOTTERY_KV`

### 创建 D1

```bash
pnpm wrangler d1 create lldc-db
```

### 创建 KV

```bash
pnpm wrangler kv namespace create LOTTERY_KV
```

### 在 Worker 中绑定（示例）

本仓库默认使用 `wrangler.jsonc`，但你也可以用 `wrangler.toml`。下面两种写法等价（按你项目实际配置选择一种即可）。

`wrangler.toml` 示例：

```toml
[[d1_databases]]
binding = "DB"
database_name = "lldc-db"
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "LOTTERY_KV"
id = "YOUR_KV_NAMESPACE_ID"
```

`wrangler.jsonc` 示例：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "lldc-db",
      "database_id": "YOUR_D1_DATABASE_ID"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "LOTTERY_KV",
      "id": "YOUR_KV_NAMESPACE_ID"
    }
  ]
}
```

## 环境变量/Secrets

必须：

- `JWT_SECRET`
- `LINUXDO_CLIENT_ID`
- `LINUXDO_CLIENT_SECRET`
- `CREDIT_PID`
- `CREDIT_KEY`
- `DRAW_RUN_TOKEN`

可选：

- `LINUXDO_SCOPE`：OAuth scope（按 LinuxDO 配置）
- `ADMIN_USER_IDS`：逗号分隔 linuxdoUserId，例如 `1001,1002`
- `LINUXDO_FEE_RATE`：默认 `0`，范围 `[0,1]`
- `CACHE_VERSION`：默认 `v1`
- `CACHE_TTL_*`：缓存 TTL（秒），默认值见下
- `CREDIT_NOTIFY_URL` / `CREDIT_RETURN_URL`：不配则使用当前请求 `origin` 自动生成

说明：除 DB/KV bindings 外，其它配置优先从 `getCloudflareContext().env` 读取；在本地开发/构建场景会回退到 `process.env`（如 `.dev.vars` 注入）。

设置 secrets：

```bash
wrangler secret put JWT_SECRET
wrangler secret put LINUXDO_CLIENT_ID
wrangler secret put LINUXDO_CLIENT_SECRET
wrangler secret put CREDIT_PID
wrangler secret put CREDIT_KEY
wrangler secret put DRAW_RUN_TOKEN
```

## 数据库初始化（D1）

你已用 Drizzle 生成初始化 SQL（当前仓库为 `drizzle/0000_redundant_cardiac.sql`）。可直接用 Wrangler 执行（注意这里是 **D1 database_name/ID**，不是 binding 名）：

```bash
wrangler d1 execute "lldc-db" --remote --file "./drizzle/0000_redundant_cardiac.sql"
```

也可以使用脚本自动从 `wrangler.jsonc` 读取 database_name 并执行：

```bash
pnpm db:apply:remote
```

如你希望走 Wrangler 的 `migrations/` 工作流，可将该 SQL 移入 `migrations/` 并按 Wrangler 文档执行 `wrangler d1 migrations apply ...`。

## 缓存 Key 与 TTL（默认）

Key：

- `lottery:${CACHE_VERSION}:dashboard:${drawId}`（30s）
- `lottery:${CACHE_VERSION}:pool:${drawId}`（20s）
- `lottery:${CACHE_VERSION}:draws:list:${limit}:${cursorOr0}`（600s）
- `lottery:${CACHE_VERSION}:draw:${drawId}:detail`（86400s）
- `lottery:${CACHE_VERSION}:participants:${drawId}:${limit}:${cursorOr0}`（30s）

失效：

- notify paid 成功：清理当期 `dashboard/pool/participants`
- draw/run 成功：清理当期 `dashboard/pool/draws list/participants`；并写入 `draw detail`（长 TTL）

## 开发与部署

开发：

```bash
pnpm dev
```

本地预览（Cloudflare runtime）：

```bash
pnpm preview
```

部署：

```bash
pnpm deploy
```

## API（curl）

以下示例以本地 `http://localhost:3000` 为例。

### 1) LinuxDO 登录

浏览器打开：`http://localhost:3000/api/auth/login`，完成授权后会回跳 `/dashboard` 并写入 `session` cookie。

### 2) 下单（返回 auto-submit HTML）

```bash
curl -i "http://localhost:3000/api/lottery/orders" \
  -H "content-type: application/json" \
  -b cookies.txt \
  -d "{\"ticketCount\":2}" -o pay.html
```

### 3) notify（回调，成功必须返回 success）

> 需要正确的 `sign`（MD5 小写签名，排除 sign/sign_type，忽略空值，ASCII 排序，末尾追加 CREDIT_KEY）。

```bash
curl -i "http://localhost:3000/api/credit/notify?pid=YOUR_PID&trade_no=T123&out_trade_no=YOUR_OUT_TRADE_NO&money=20&trade_status=TRADE_SUCCESS&sign_type=MD5&sign=YOUR_SIGN"
```

### 4) dashboard

```bash
curl -s "http://localhost:3000/api/lottery/dashboard"
```

### 5) 我的订单列表

```bash
curl -s "http://localhost:3000/api/lottery/me/orders?limit=20&cursor=0" \
  -b cookies.txt
```

### 6) 查询订单详情（本人或管理员）

```bash
curl -s "http://localhost:3000/api/lottery/orders/YOUR_OUT_TRADE_NO" \
  -b cookies.txt
```

### 7) participants

```bash
curl -s "http://localhost:3000/api/lottery/draws/2025-01-01/participants?limit=50&cursor=0"
```

### 8) draw/run（Bearer token）

```bash
curl -i "http://localhost:3000/api/draw/run" \
  -H "authorization: Bearer YOUR_DRAW_RUN_TOKEN" \
  -H "content-type: application/json" \
  -d "{}"
```

## Cron Worker（可选）

目录：`cron-worker/`

- `cron-worker/wrangler.toml` 已配置 `0 0 * * *`（UTC）触发，即台北 08:00
- 通过 service binding `TARGET_WORKER` 调用主 Worker 的 `/api/draw/run`

部署 cron worker 前，请为 cron worker 单独设置 `DRAW_RUN_TOKEN` secret，并确保 `TARGET_WORKER` 指向主 worker（`lldc`）。

## LinuxDO Credit 查询/退款（兜底）

LinuxDO Credit 文档中提到的 `api.php` 查询与退款能力（通常要求 `trade_no`，且退款必须全额）本项目**未实现为业务接口**，仅作为排障/兜底手段：

- 查询订单：请按官方文档调用对应 `api.php`（以 `trade_no` 为主键查询）
- 退款：请按官方文档执行全额退款流程

建议将这两类操作封装为独立脚本/运维手册（避免在业务服务内引入“主动转账/退款”逻辑）。

## 事务与幂等保证

- `GET /api/credit/notify`：即使发生异常也始终返回 HTTP200 `success`，避免对方重试风暴；同时写入 `audit_events(type="credit_notify_error")` 记录失败原因。
- notify 事务：`orders(pending->paid)` + `tickets` 插入（严格使用 `orders.numbers_json` 快照号码）+ 成功审计，在同一 D1 事务内提交；若条件更新行数=0（已 paid）则直接幂等返回，不会重复插票。
- `POST /api/draw/run`：先抢 `open -> closing` 锁；抢锁失败时
  - 已开奖（drawn）：返回已有 `winning`（幂等）
  - 正在开奖（closing）：返回 HTTP202
- 开奖事务：读取 draw/tickets（最小字段）→ 计算 `tickets_hash`/winning/分配 → 批量更新 tickets/prizes → 插入 payouts → SQL 聚合回填 `orders.bonus_points` → 更新 draws 为 `drawn`，在单个 D1 事务内提交；KV 缓存清理/写入在事务提交后执行。

---

# OpenNext Starter

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Read the documentation at https://opennext.js.org/cloudflare.

## Develop

Run the Next.js development server:

```bash
npm run dev
# or similar package manager command
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
npm run preview
# or similar package manager command
```

## Deploy

Deploy the application to Cloudflare:

```bash
npm run deploy
# or similar package manager command
```

## GitHub Actions (Deploy to Workers)

This repo includes a GitHub Actions workflow that deploys to Cloudflare Workers on `push` to `main`.

Required repository secrets (GitHub → Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Notes:

- The Worker name is configured in `wrangler.jsonc` as `lldc`.
- The workflow runs `pnpm run deploy` (OpenNext build + Wrangler deploy).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
