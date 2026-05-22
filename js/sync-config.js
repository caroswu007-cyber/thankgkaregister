/**
 * 报名自动归档（减少手工粘贴腾讯表格）
 *
 * Supabase：先在 SQL Editor 执行 docs/supabase-autosync.md 里的建表 + RLS。
 *
 * 二选一配置方式：
 * ① Vercel：在 Project → Environment Variables 设置 SUPABASE_URL、SUPABASE_ANON_KEY，
 *    构建时由 scripts/inject-sync-config.js 写入本文件（勿把 anon key 提交进公开仓库时推荐）。
 * ② 本地 / 任意托管：直接把下方 supabaseUrl、supabaseAnonKey 填字符串后部署。
 *
 * anon key 可出现在前端时，务必只给 anon 配 insert 策略、勿给 anon select。
 * 留空则不同步（仍可走 EmailJS）。
 */
window.TangkaSyncConfig = {
  /** 例：https://xxxx.supabase.co/rest/v1/registrations 或 https://xxxx.supabase.co（代码会自动补全路径） */
  supabaseUrl: "https://puojpetxyxvuddbdhgsy.supabase.co",

  /** Project Settings → API → anon public */
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2pwZXR4eXh2dWRkYmRoZ3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTIzNjIsImV4cCI6MjA5MzEyODM2Mn0.KGX0S-l1r4s_Q8XvgJdV7TK11xQb-wHxmVrg335PviI",

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
