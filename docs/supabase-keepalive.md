# Supabase Keepalive

本项目使用 GitHub Actions 定时调用 Supabase RPC，避免 Free 项目因 1 周无数据库活动而暂停。

## GitHub Secrets

在 GitHub 仓库设置中添加：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

取值与 Vercel 环境变量一致。

## 工作流

文件：`.github/workflows/supabase-keepalive.yml`

- 每 3 天自动运行一次。
- 可在 GitHub Actions 页面手动运行 `Supabase Keepalive`。
- 调用 `query_registration_status`，参数为不存在的姓名与证件后 6 位，只触发读取，不写入报名数据。

如果 Action 失败，先检查两个 Secrets 是否已填写，以及 Supabase 中是否已执行 `scripts/supabase-query-registration-status.sql`。
