/**
 * Vercel / CI：从环境变量写入 js/sync-config.js 中的 Supabase 字段。
 * 本地不设变量时跳过，保持仓库里的空字符串便于开发。
 *
 * 在 Vercel → Project → Settings → Environment Variables 添加：
 *   SUPABASE_URL      = https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY = （anon public，Project Settings → API）
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const target = path.join(root, "js", "sync-config.js");

const url = String(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).trim();
const key = String(
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
).trim();

let s = fs.readFileSync(target, "utf8");

if (url || key) {
  if (url) {
    s = s.replace(/supabaseUrl:\s*""/m, `supabaseUrl: ${JSON.stringify(url)}`);
  }
  if (key) {
    s = s.replace(
      /supabaseAnonKey:\s*""/m,
      `supabaseAnonKey: ${JSON.stringify(key)}`
    );
  }
  fs.writeFileSync(target, s);
  console.log(
    "[inject-sync-config] 已写入 Supabase：" +
      (url ? "URL " : "") +
      (key ? "anon/publishable key" : "")
  );
} else {
  console.log(
    "[inject-sync-config] 未设置 SUPABASE_URL / SUPABASE_ANON_KEY，跳过"
  );
}
