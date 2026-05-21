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
const outputDir = path.join(root, "public");

const url = String(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).trim();
const key = String(
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
).trim();

let s = fs.readFileSync(target, "utf8");

if (url || key) {
  if (url) {
    s = s.replace(
      /supabaseUrl:\s*"[^"]*"/,
      `supabaseUrl: ${JSON.stringify(url)}`
    );
  }
  if (key) {
    s = s.replace(
      /supabaseAnonKey:\s*"[^"]*"/,
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

/**
 * Vercel 当前项目的 Output Directory 配置为 public。
 * 本项目源码是根目录静态站，因此构建时把可发布文件复制到 public/。
 */
const publishEntries = [
  "index.html",
  "register.html",
  "query.html",
  "success.html",
  "admin.html",
  "css",
  "js",
  "images",
  "data",
  "素材",
];

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const child of fs.readdirSync(from)) {
      copyRecursive(path.join(from, child), path.join(to, child));
    }
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const entry of publishEntries) {
  const from = path.join(root, entry);
  const to = path.join(outputDir, entry);
  if (!fs.existsSync(from)) continue;
  copyRecursive(from, to);
}

console.log("[inject-sync-config] 已生成 public/ 静态发布目录");
