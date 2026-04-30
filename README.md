# 唐卡传承公益体验课 · 报名系统

纯静态页面（HTML / CSS / JS），可选 EmailJS、Supabase、腾讯文档智能表代理等扩展。

## 推送到 GitHub

```bash
git init
git add .
git status   # 确认无 server/.env、腾讯文档接口密码.txt
git commit -m "Initial commit: 唐卡报名静态站"
```

在 GitHub 新建空仓库后：

```bash
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

**切勿提交**：`server/.env`、`腾讯文档接口密码.txt`（已在 `.gitignore` 中忽略）。

## 部署到 Vercel

1. 登录 [Vercel](https://vercel.com)，**Add New Project** → Import 上述 GitHub 仓库。  
2. **Framework Preset** 选 **Other**（或保持自动检测为静态站点）。  
3. **Root Directory** 保持仓库根目录；**Build Command** 留空；**Output Directory** 留空或 `.`。  
4. Deploy。首页一般为 `/` → `index.html`；`cleanUrls` 已开启，可用 `/register` 等形式访问（见 `vercel.json`）。

部署完成后，在仓库或 Vercel 本地再编辑 **`js/email-config.js`**、**`js/sync-config.js`** 等配置（或通过后续 CI 注入），重新推送即可生效。

## 腾讯推送代理 `server/`

`server/` 为本地/自建机上的 **Node 服务**，用于调用腾讯文档 OpenAPI（`POST /append` 写入、`POST /query` 学员查询）；**不是** Vercel 默认一键部署的 Serverless 形态。需单独部署到公网 HTTPS，并在前端 `tencentProxyUrl` 填写 `…/append`；查询页会自动使用同源 `…/query`（见 `docs/tencent-server-push.md`、`js/query-config.js`）。未部署代理时，学员查询仍使用 `data/students.json`。

## 文档

- `进度说明.md`、`开发计划.md` — 项目说明  
- `docs/supabase-autosync.md` — Supabase 可选同步  
- `docs/emailjs-setup.md` — EmailJS 双邮件（报名者 + 管理员）  
- `docs/tencent-server-push.md` — 腾讯智能表服务端推送  
