# ETF Monitor

## 本地开发

```bash
npm ci
npm run dev
```

前端：`http://localhost:5173/`

后端：`http://localhost:3001/api/health`

## Vercel 部署

项目使用 Vite 构建前端静态站点，并通过 `api/index.ts` 作为 Vercel Serverless Function 承载 `/api/*` 接口。

在 Vercel Project Settings 中配置环境变量（Preview/Production 都要配置）：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Supabase

数据库表结构在 `supabase/migrations/0001_top100_latest.sql`。

GitHub Actions 会定时运行 `npm run refresh:supabase:top100` 把最新快照写入 `top100_latest(id=1)`。

需要在 GitHub 仓库 Secrets 中配置：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## GitHub Actions 自动部署到 Vercel

工作流文件：`.github/workflows/vercel-deploy.yml`

需要在 GitHub 仓库 Secrets 中配置：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
