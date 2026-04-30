# 腾讯文档智能表：服务端一键推送

浏览器无法安全保存腾讯 OAuth 的 **Client Secret**，因此用本仓库 `server/` 小服务在服务端调用 [智能表追加记录 OpenAPI](https://docs.qq.com/open/document/app/openapi/v2/smartsheet/record/add_records.html)，前端只配置 **HTTPS 代理地址** + **Webhook 密钥**。

## 1. 开放平台与应用

1. 打开 [腾讯文档开放平台](https://docs.qq.com/open/document/app/)，注册并创建应用，拿到 **Client ID**、**Client Secret**。
2. 按官方文档完成 **OAuth 授权码** 流程，在服务端用 `code` 换 `access_token`、`refresh_token`、`user_id`（即下文 **Open-Id**）。  
   - Token 会过期，生产环境请用 `refresh_token` 定期刷新，并更新环境变量或进程内缓存（本示例为静态 `TENCENT_ACCESS_TOKEN`，便于先跑通）。

## 2. 为什么在开放平台「首页」找不到 fileID / sheetID？

**开发者首页**只展示应用级信息：`client_id`、`access_token`、`open_id` 等。  
**fileID、sheetID 属于某一个在线文档**，不会出现在首页，必须从 **你打开的那张智能表格** 的链接或接口里取。

### 2.1 从浏览器地址栏取（最省事）

1. 用浏览器打开你的 **智能表格**（子表类型需为智能表 / smartsheet；若只有普通工作表，需在文档里新建「智能表」子表）。
2. 看地址栏，官方说明见 [Smartsheet 基本概念](https://docs.qq.com/open/document/app/openapi/v2/smartsheet/common/concept.html)：
   - 链接形如：`https://docs.qq.com/sheet/DAAAAAAAAAAAA?tab=BB0000`
   - 其中路径里 **`/sheet/` 后面那一段**（如 `DAAAAAAAAAAAA`）是文档的 **encodedID**，OpenAPI 用的 **fileID** 要通过 [fileID 转换](https://docs.qq.com/open/document/app/openapi/v2/file/util/converter.html) 接口由 `encodedID` 转成 `fileID`（形如 `300000000$…`）。
   - **`?tab=` 后面的值**（如 `BB0000`）就是该智能子表的 **sheetID**，可直接填 `TENCENT_SHEET_ID`。

### 2.2 用本仓库脚本自动转换 fileID

在 `server/.env` 里已配置好 `TENCENT_ACCESS_TOKEN`、`TENCENT_CLIENT_ID`、`TENCENT_OPEN_ID` 后，在 **`server` 目录**执行：

```bash
npm run resolve-fileid -- "https://docs.qq.com/sheet/你的D开头ID?tab=你的tab值"
```

终端会打印可直接粘贴进 `.env` 的 `TENCENT_FILE_ID=` 与 `TENCENT_SHEET_ID=`（若链接里带 `tab=`）。

### 2.3 智能表列名

第一行列名必须与站内 `js/tencent-docs-sync.js` 里 `SHEET_HEADERS` **完全一致**（建议列类型均为「文本」，与代理里 `textCell` 写入方式一致）。

## 3. 部署代理服务

```bash
cd server
copy .env.example .env
# 编辑 .env：WEBHOOK_SECRET、TENCENT_*、FILE_ID、SHEET_ID
npm install
npm start
```

默认监听 `8787`（可用环境变量 `PORT`、`HOST` 修改）。**必须先启动进程**，再在浏览器访问，否则会提示无法连接。

- **Windows**：双击 `server/启动服务.bat`（首次会自动 `npm install`）。
- **命令行**：`cd server` 后执行 `npm start`。

打开：

- [http://127.0.0.1:8787/](http://127.0.0.1:8787/) — 简要说明页  
- [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health) — JSON 配置检查  

**接口**：

- `POST /append` — 请求体为 JSON，字段与前端 `registration-sync.js` 的 `buildPayload` 一致；请求头 `X-Webhook-Secret` 须与 `.env` 中 `WEBHOOK_SECRET` 一致（未设置 `WEBHOOK_SECRET` 时不校验，不推荐生产环境）。
- `POST /query` — 学员查询：请求体 JSON `{ "name": "姓名", "id_last6": "123456" }`（后 6 位仅数字）。服务端调用 [查询记录](https://docs.qq.com/open/document/app/openapi/v2/smartsheet/record/get_records.html) 分页拉取当前子表全部行，在内存中按 **姓名** 与 **身份证号列取后 6 位** 匹配（与报名表列名一致）。需应用具备 `scope.smartsheet` 等读权限。可选环境变量 **`QUERY_CURRENT_COURSE_LINE`** 用于返回给前端的「本期课程」展示句（见 `server/.env.example`）。

若静态站点托管在公网，浏览器 **无法** 直接访问你电脑上的 `127.0.0.1`；需把本服务部署到公网 HTTPS，并在 `js/sync-config.js` 填写 `tencentProxyUrl`。

将服务暴露为 **HTTPS**（如 Nginx 反代、腾讯云 API 网关、云函数 HTTP 触发等），记下完整 URL，例如 `https://api.example.com/append`（查询页会自动将 `…/append` 换为 `…/query`，也可在 `js/query-config.js` 单独写 `tencentQueryUrl`）。

## 4. 前端配置

在 `js/sync-config.js` 中填写：

- `tencentProxyUrl`：上一步的 `https://.../append`（无尾部斜杠也可）。
- `tencentProxySecret`：与 `WEBHOOK_SECRET` 相同。

**学员查询（腾讯源）**：`query.html` 已引入 `js/query-config.js`。若已配置 `tencentProxyUrl`，查询页会 **自动** 请求同源 `…/query`，无需再填（除非代理与报名不同域名，此时在 `query-config.js` 填写 `tencentQueryUrl`）。密钥默认复用 `tencentProxySecret`，也可单独设 `tencentQuerySecret`。未配置腾讯代理时，仍使用 `data/students.json`。

保存后重新部署静态站点。提交报名表时，会 **优先** 调用腾讯代理；未配置时仍可使用 `customPostUrl`、Supabase 或仅邮件/导出 CSV。

## 5. CORS

代理已使用 `cors()` 允许浏览器跨域 POST。若你在外层再加一层网关，请确保对 `OPTIONS` / `POST` 放行，并透传 `Content-Type`、`X-Webhook-Secret`。

## 6. 故障排查

- 腾讯返回 `ret !== 0`：对照开放平台错误码；常见为 token 过期、列名与智能表不一致、fileID/sheetID 错误。
- `401 invalid X-Webhook-Secret`：前后端密钥不一致或未带请求头。
- `503 missingEnv`：服务端未配置完整 `TENCENT_*` 变量。
