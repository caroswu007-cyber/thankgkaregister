/**
 * 本地 E2E：打开报名页提交 → 监听 Supabase POST → 打开管理后台尝试登录
 * 用法：npx --yes -p playwright node scripts/e2e-flow.mjs
 * 需先在本目录启动静态服务：npx serve -l 8899 .
 */
import { chromium } from "playwright";
import crypto from "crypto";

const BASE = process.env.TANGKA_E2E_BASE || "http://127.0.0.1:8899";
const ADMIN_SECRET = process.env.TANGKA_ADMIN_SECRET || "";

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: "chrome",
    });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const markers = {
    name: "E2E自动化_" + Date.now(),
    idCard: "440305199801018034",
    phone: "139" + String(Date.now()).slice(-8),
    wechat: "e2e_wx_" + Date.now(),
    age: "28",
    email: `e2e-${Date.now()}@example.com`,
  };

  /** @type {{ status?: number, ok?: boolean }} */
  const supa = {};

  page.on("response", async (response) => {
    const url = response.url();
    const req = response.request();
    if (
      url.includes("/rest/v1/registrations") &&
      req.method() === "POST"
    ) {
      supa.status = response.status();
      supa.ok = response.ok();
      console.log("[e2e] Supabase POST", supa.status, supa.ok ? "ok" : "fail");
    }
  });

  console.log("[e2e] register.html …");
  await page.goto(`${BASE}/register.html`, { waitUntil: "domcontentloaded" });

  await page.fill("#field-name", markers.name);
  await page.fill("#field-id-card", markers.idCard);
  await page.fill("#field-phone", markers.phone);
  await page.fill("#field-wechat", markers.wechat);
  await page.fill("#field-age", markers.age);
  await page.fill("#field-email", markers.email);
  await page.click('input[name="gender"][value="男"]');
  await page.fill("#field-city", "深圳市");
  await page.click('input[name="art_base"][value="无基础"]');
  await page.check("#health-family");
  await page.check("#health-body");
  await page.check("#health-rules");

  await Promise.all([
    page.waitForURL(/success\.html/, { timeout: 120000 }),
    page.click("#btn-submit"),
  ]);

  console.log("[e2e] success URL:", page.url());
  console.log(
    "[e2e] id_hash (应与库内一致):",
    sha256Hex(markers.idCard)
  );

  console.log("[e2e] admin.html …");
  await page.goto(`${BASE}/admin.html`, { waitUntil: "domcontentloaded" });

  if (!ADMIN_SECRET) {
    await page.fill("#adm-password", "__wrong_secret_probe__");
    await page.click('#admin-login-form button[type="submit"]');
    await page.waitForTimeout(2000);
    const err = await page.locator("#adm-login-error").textContent();
    const dashHidden = await page.locator("#admin-dashboard").isHidden();
    console.log(
      "[e2e] 未设置 TANGKA_ADMIN_SECRET：已用错误口令探测登录，错误提示:",
      (err || "").trim() || "(无文案)"
    );
    console.log("[e2e] 控制台仪表盘隐藏（预期）:", dashHidden);
  } else {
    await page.fill("#adm-password", ADMIN_SECRET);
    await page.click('#admin-login-form button[type="submit"]');
    await page.waitForSelector("#admin-dashboard:not([hidden])", {
      timeout: 15000,
    });
    await page.click("#adm-btn-refresh");
    await page.waitForTimeout(1500);
    const tbody = await page.locator("#adm-reg-tbody").innerHTML();
    const hit = tbody.includes(markers.name);
    console.log("[e2e] 管理后台已登录；列表含本次姓名:", hit);
    if (!hit) {
      console.log(
        "[e2e] 提示：若刚写入 Supabase，可检查排序/刷新或 RLS header"
      );
    }
  }

  await browser.close();
  console.log("[e2e] done");
})().catch((e) => {
  console.error("[e2e] FAILED:", e.message);
  process.exit(1);
});
