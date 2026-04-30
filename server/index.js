/**
 * 腾讯文档智能表 — 报名追加 + 学员查询代理
 *
 * - POST /append — add_records
 * - POST /query — get_records 分页拉取后按姓名+身份证后 6 位匹配（与 query 页一致）
 *
 * 文档：https://docs.qq.com/open/document/app/openapi/v2/smartsheet/record/add_records.html
 *       https://docs.qq.com/open/document/app/openapi/v2/smartsheet/record/get_records.html
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const ACCESS_TOKEN = process.env.TENCENT_ACCESS_TOKEN || "";
const CLIENT_ID = process.env.TENCENT_CLIENT_ID || "";
const OPEN_ID = process.env.TENCENT_OPEN_ID || "";
const FILE_ID = process.env.TENCENT_FILE_ID || "";
const SHEET_ID = process.env.TENCENT_SHEET_ID || "";
const PORT = parseInt(process.env.PORT || "8787", 10);
/** 默认 0.0.0.0，本机可用 127.0.0.1 / localhost；局域网其它设备用本机 IP */
const HOST = process.env.HOST || "0.0.0.0";

/** 查询结果「本期课程」展示行（智能表报名表无单独课程维度时的固定文案） */
const QUERY_CURRENT_COURSE_LINE =
  process.env.QUERY_CURRENT_COURSE_LINE ||
  "唐卡传承公益体验课（2026年4月8日 — 4月12日 · 以腾讯文档登记表为准）";

const GET_RECORDS_PAGE_LIMIT = 100;

/** 智能表列标题须与站内 js/tencent-docs-sync.js 中 SHEET_HEADERS 完全一致；列类型建议均为「文本」以便统一写入 */
function textCell(s) {
  return [{ type: "text", text: String(s == null ? "" : s) }];
}

function yn(b) {
  return textCell(b ? "是" : "否");
}

/**
 * @param {object} body 前端 buildPayload：snake_case + id_hash 等
 */
function bodyToTencentValues(body) {
  return {
    姓名: textCell(body.name),
    身份证号: textCell(body.id_card),
    手机号: textCell(body.phone),
    微信号: textCell(body.wechat),
    年龄: textCell(body.age),
    电子邮箱: textCell(body.email),
    性别: textCell(body.gender),
    所在城市: textCell(body.city),
    绘画基础: textCell(body.art_base),
    家属同意: yn(!!body.health_family),
    身体健康声明: yn(!!body.health_body),
    知晓活动规则: yn(!!body.health_rules),
    身份证SHA256: textCell(body.id_hash),
    提交时间: textCell(body.submitted_at),
  };
}

function assertConfig() {
  const miss = [];
  if (!ACCESS_TOKEN) miss.push("TENCENT_ACCESS_TOKEN");
  if (!CLIENT_ID) miss.push("TENCENT_CLIENT_ID");
  if (!OPEN_ID) miss.push("TENCENT_OPEN_ID");
  if (!FILE_ID) miss.push("TENCENT_FILE_ID");
  if (!SHEET_ID) miss.push("TENCENT_SHEET_ID");
  return miss;
}

async function tencentSmartsheetPost(payload) {
  const url = `https://docs.qq.com/openapi/smartbook/v2/files/${encodeURIComponent(FILE_ID)}/sheets/${encodeURIComponent(SHEET_ID)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Access-Token": ACCESS_TOKEN,
      "Client-Id": CLIENT_ID,
      "Open-Id": OPEN_ID,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("腾讯接口非 JSON：" + text.slice(0, 200));
  }
  if (data.ret !== 0) {
    const err = new Error(data.msg || "腾讯接口错误 ret=" + data.ret);
    err.tencent = data;
    throw err;
  }
  return data;
}

function appendToSmartsheet(values) {
  return tencentSmartsheetPost({
    addRecords: {
      records: [{ values }],
    },
  });
}

/** 从智能表单元格取值（文本列为 [{type,text}]） */
function cellText(values, title) {
  const v = values[title];
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    if (!v.length) return "";
    const x = v[0];
    if (x && x.type === "text" && x.text != null) {
      return String(x.text).replace(/\r|\n/g, " ").trim();
    }
    if (typeof x === "object" && x.text != null) return String(x.text).trim();
  }
  return String(v);
}

function idLast6FromCardDigits(idRaw) {
  const d = String(idRaw || "").replace(/\D/g, "");
  return d.length >= 6 ? d.slice(-6) : d;
}

function maskPhone(p) {
  const s = String(p || "").replace(/\s/g, "");
  if (/^1\d{10}$/.test(s)) return s.slice(0, 3) + "****" + s.slice(-4);
  if (s.length >= 7) return s.slice(0, 2) + "****" + s.slice(-2);
  return s || "—";
}

async function fetchAllRecordsTencent() {
  const all = [];
  let offset = 0;
  for (;;) {
    const data = await tencentSmartsheetPost({
      getRecords: {
        offset,
        limit: GET_RECORDS_PAGE_LIMIT,
      },
    });
    const block = data.data && data.data.getRecords;
    if (!block) break;
    const recs = block.records || [];
    for (let i = 0; i < recs.length; i++) all.push(recs[i]);
    if (!block.hasMore) break;
    const next =
      block.next != null ? block.next : offset + recs.length;
    offset = next;
    if (recs.length === 0) break;
    if (all.length > 20000) {
      throw new Error("记录行数过多，请缩小子表或联系管理员");
    }
  }
  return all;
}

function rowMatchesQuery(rec, nameNorm, last6) {
  const values = rec.values || {};
  const rowName = String(cellText(values, "姓名")).trim();
  const rowLast6 = idLast6FromCardDigits(cellText(values, "身份证号"));
  return rowName === nameNorm && rowLast6 === last6;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/", (_req, res) => {
  res.type("html").send(
    "<!doctype html><meta charset=utf-8><title>唐卡报名·腾讯推送</title>" +
      "<p>服务已启动。</p>" +
      "<ul>" +
      "<li><a href=\"/health\">/health</a> — 检查配置</li>" +
      "<li>POST <code>/append</code> — 报名表写入智能表</li>" +
      "<li>POST <code>/query</code> — 学员查询（姓名 + 身份证后 6 位）</li>" +
      "</ul>" +
      "<p>若本页能打开但外网站点调不通，需把本服务部署到公网 HTTPS，并在 <code>js/sync-config.js</code> 填写 <code>tencentProxyUrl</code>。</p>"
  );
});

app.get("/health", (_req, res) => {
  const miss = assertConfig();
  res.json({
    ok: true,
    configured: miss.length === 0,
    missingEnv: miss,
  });
});

app.post("/append", async (req, res) => {
  try {
    if (WEBHOOK_SECRET) {
      const got = req.headers["x-webhook-secret"] || "";
      if (got !== WEBHOOK_SECRET) {
        return res.status(401).json({ ok: false, error: "invalid X-Webhook-Secret" });
      }
    }

    const miss = assertConfig();
    if (miss.length) {
      return res.status(503).json({
        ok: false,
        error: "服务端未配置腾讯环境变量",
        missingEnv: miss,
      });
    }

    const body = req.body;
    if (!body || typeof body.name !== "string" || !body.id_card) {
      return res.status(400).json({ ok: false, error: "请求体缺少必要字段" });
    }

    const values = bodyToTencentValues(body);
    const data = await appendToSmartsheet(values);
    return res.json({ ok: true, tencent: data });
  } catch (e) {
    console.error(e);
    return res.status(502).json({
      ok: false,
      error: String(e.message || e),
      tencent: e.tencent || undefined,
    });
  }
});

app.post("/query", async (req, res) => {
  try {
    if (WEBHOOK_SECRET) {
      const got = req.headers["x-webhook-secret"] || "";
      if (got !== WEBHOOK_SECRET) {
        return res.status(401).json({ ok: false, error: "invalid X-Webhook-Secret" });
      }
    }

    const miss = assertConfig();
    if (miss.length) {
      return res.status(503).json({
        ok: false,
        error: "服务端未配置腾讯环境变量",
        missingEnv: miss,
      });
    }

    const body = req.body || {};
    const nameNorm = String(body.name || "").trim();
    const last6 = String(body.id_last6 || "").replace(/\D/g, "");
    if (!nameNorm) {
      return res.status(400).json({ ok: false, error: "缺少 name" });
    }
    if (last6.length !== 6) {
      return res.status(400).json({ ok: false, error: "id_last6 须为 6 位数字" });
    }

    const records = await fetchAllRecordsTencent();
    const matches = [];
    for (let i = 0; i < records.length; i++) {
      if (rowMatchesQuery(records[i], nameNorm, last6)) matches.push(records[i]);
    }

    if (matches.length === 0) {
      return res.json({ ok: true, found: false });
    }
    if (matches.length > 1) {
      return res.status(409).json({
        ok: false,
        error: "ambiguous",
        message: "存在多条匹配记录，请联系工作人员核实。",
      });
    }

    const values = matches[0].values || {};
    return res.json({
      ok: true,
      found: true,
      source: "tencent_smartsheet",
      statusDisplay: "已在腾讯文档登记",
      currentCourseLine: QUERY_CURRENT_COURSE_LINE,
      student: {
        name: String(cellText(values, "姓名")).trim(),
        phone: maskPhone(cellText(values, "手机号")),
        wechat: cellText(values, "微信号") || "—",
        submittedAt: cellText(values, "提交时间") || "",
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({
      ok: false,
      error: String(e.message || e),
      tencent: e.tencent || undefined,
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(
    "tangka-tencent-append listening on http://127.0.0.1:" +
      PORT +
      " (and http://localhost:" +
      PORT +
      ")"
  );
  console.log("  GET  /       说明页");
  console.log("  GET  /health 配置检查");
  console.log("  POST /append 写入智能表");
  console.log("  POST /query  学员查询");
});

