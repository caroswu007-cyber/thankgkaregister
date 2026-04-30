/**
 * 报名自动归档（减少手工粘贴腾讯表格）
 *
 * 推荐：Supabase 免费项目 — 浏览器直接把一行写入数据库，无需自建服务器。
 * 填好下面三项后，报名表会随提交一并写入；可不依赖管理员逐条复制邮件里的 TSV。
 *
 * 留空则不同步（仍可走 EmailJS / 演示模式）。
 */
window.TangkaSyncConfig = {
  /** 例：https://xxxx.supabase.co/rest/v1/registrations */
  supabaseUrl: "",

  /** Project Settings → API → anon public */
  supabaseAnonKey: "",

  /** 与数据库表名一致（见 docs/supabase-autosync.md） */
  supabaseTable: "registrations",

  /**
   * 任意支持 CORS 的 HTTPS 地址，POST JSON。
   * 若填写则优先于 Supabase（用于飞书 Webhook、自建 Worker 等）。
   * 请求体：registration-sync.js 内 buildPayload 生成的对象，可外加 token 字段。
   */
  customPostUrl: "",
  customToken: "",

  /**
   * 腾讯文档智能表「服务端一键推送」代理地址（需自建 server/ 并部署）。
   * 例：https://你的域名/append — 与 server/index.js 的 POST /append 一致。
   * 若填写且以 http 开头，提交时优先于 customPostUrl / Supabase。
   */
  tencentProxyUrl: "",

  /** 与 server/.env 中 WEBHOOK_SECRET 一致，通过请求头 X-Webhook-Secret 传递 */
  tencentProxySecret: "",
};
