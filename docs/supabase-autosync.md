# 报名自动写入 Supabase（少操作腾讯表格）

静态网页无法直接调用腾讯文档写入接口。推荐用 **Supabase** 免费数据库作为「自动台账」：学员提交后 **浏览器直接插入一行**，管理员只需偶尔在 Supabase 里 **导出 CSV**，再导入腾讯表格（或长期以 Supabase 为准）。

## 一次性配置（约 10 分钟）

1. 打开 [supabase.com](https://supabase.com) 新建项目（免费层即可）。
2. 左侧 **SQL Editor**，新建查询，粘贴并执行下方 **建表 + RLS** 脚本。
3. **Project Settings → API**，复制 **Project URL** 与 **anon public** key。
4. 配置前端凭证（二选一）：
   - **手写**：编辑 `js/sync-config.js` 中的 `supabaseUrl`、`supabaseAnonKey`。
   - **Vercel**：跳过手写，改按下方 **「在 Vercel 用环境变量」** 设置 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`。
5. （可选）仍可同时配置 EmailJS：提交时 **自动写库 + 发邮件** 并行执行。

### 在 Vercel 用环境变量（推荐，避免把 anon key 写进 Git）

仓库已包含 `package.json` 的 `npm run build`（执行 `scripts/inject-sync-config.js`）与 `vercel.json` 的 `buildCommand`。

1. 将含上述改动的代码 **push** 到 Vercel 所连的 Git 分支。
2. 在 Vercel 打开项目 → **Settings → Environment Variables**，新增两条（建议勾选 Production + Preview）：
   - `SUPABASE_URL` = `https://你的项目.supabase.co`
   - `SUPABASE_ANON_KEY` = 控制台 **Project Settings → API → anon public** 密钥  
3. **Redeploy** 一次。部署日志里应出现 `[inject-sync-config] 已写入 Supabase…`。

本地不设这两个变量时，构建脚本不会改动 `js/sync-config.js`，便于开发。

## 建表与权限（复制到 SQL Editor）

```sql
-- 报名表（列名与前端 registration-sync.js 一致，均为小写+下划线）
create table if not exists public.registrations (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  wechat text not null,
  email text not null,
  age int not null,
  gender text,
  city text,
  art_base text,
  health_family boolean not null,
  health_body boolean not null,
  health_rules boolean not null,
  id_card text not null,
  id_last6 text not null,
  id_hash text not null,
  submitted_at timestamptz not null
);

alter table public.registrations enable row level security;

-- 允许匿名仅插入（网站上的 anon key）；不允许匿名读取，避免数据被爬
create policy "允许匿名插入报名"
  on public.registrations
  for insert
  to anon
  with check (true);

-- 若已有冲突策略可先 drop 再建；管理员用 service role 在后台查看/导出
```

> **安全说明**：`anon` 密钥会出现在前端代码中，因此务必 **不要** 给 `anon` 配置 `select` 策略；仅 `insert` 即可。导出、对账在 Supabase 控制台用管理员账号操作。

## 与腾讯文档的关系

- **日常**：不再需要把邮件里的 TSV 逐行粘贴进腾讯表格。
- **若仍要用腾讯表格做对外台账**：在 Supabase **Table Editor** 打开 `registrations` → **Export CSV**，再导入腾讯文档/表格即可（频率按需要，如每周一次）。
- **飞书多维表格**：可将 `js/sync-config.js` 里的 `customPostUrl` 设为飞书自动化生成的 Webhook，由 `registration-sync.js` POST 同一 JSON 体（需在飞书侧映射字段）。

## 学员查询页

当前 `query.html` 仍读取 `data/students.json`。若希望查询也免维护 JSON，需要再在 Supabase 中增加 **RPC 函数**（按姓名+后六位返回一条）并改前端 — 可后续迭代。
