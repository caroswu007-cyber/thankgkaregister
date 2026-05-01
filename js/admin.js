/**
 * 管理员后台：
 *   - 登录 = 把口令塞进自定义 header 调用 Supabase；能拉到数据即视为登录成功
 *   - 报名总览：实时同步 Supabase registrations 表，搜索/排序/导出 CSV
 *   - 名额与开关：localStorage 本地维护
 *   - TSV → 学员 JSON 片段（辅助 data/students.json 维护）
 */
(function () {
  "use strict";

  var ADMIN_HEADER = "x-tangka-admin-secret";
  var SESSION_KEY = "tangka_admin_secret";

  function $(id) {
    return document.getElementById(id);
  }

  function getAdminCfg() {
    return window.TangkaAdminConfig || {};
  }

  function getSyncCfg() {
    return window.TangkaSyncConfig || {};
  }

  function getSecret() {
    try {
      return sessionStorage.getItem(SESSION_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setSecret(secret) {
    try {
      if (secret) sessionStorage.setItem(SESSION_KEY, secret);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (ignore) {}
  }

  function buildSupabaseRestUrl(path) {
    var sync = getSyncCfg();
    var base = String(sync.supabaseUrl || "").replace(/\/+$/, "");
    if (!base) return "";
    if (base.indexOf("/rest/v1") === -1) base += "/rest/v1";
    return base + path;
  }

  function supabaseHeaders(secret) {
    var sync = getSyncCfg();
    var key = String(sync.supabaseAnonKey || "");
    var headers = {
      "Content-Type": "application/json",
      apikey: key,
    };
    if (key.indexOf("eyJ") === 0) {
      headers.Authorization = "Bearer " + key;
    }
    if (secret) {
      headers[ADMIN_HEADER] = secret;
    }
    return headers;
  }

  /**
   * 调 Supabase 的 admin_check_secret RPC，校验口令。
   * 口令对 → 200 / 204；口令错 → 4xx，由数据库函数 raise exception。
   */
  function verifyAdminSecret(secret) {
    var url = buildSupabaseRestUrl("/rpc/admin_check_secret");
    if (!url) {
      return Promise.reject(
        new Error("尚未配置 Supabase（js/sync-config.js）。")
      );
    }
    return fetch(url, {
      method: "POST",
      headers: supabaseHeaders(secret),
      body: "{}",
    }).then(function (r) {
      if (r.ok) return true;
      if (r.status === 401 || r.status === 403 || r.status === 400) {
        var err = new Error("口令错误。");
        err.code = "AUTH";
        throw err;
      }
      return r.text().then(function (t) {
        throw new Error("Supabase HTTP " + r.status + (t ? " " + t : ""));
      });
    });
  }

  /**
   * 拉全部报名（按提交时间倒序）。返回 Promise<Array>。
   * 注意：RLS 策略下，口令错 = 0 行（不是 401），所以这里不再用空数组判定口令错；
   * 口令校验由 verifyAdminSecret 负责。
   */
  function fetchRegistrations(secret) {
    var sync = getSyncCfg();
    var table = sync.supabaseTable || "registrations";
    var url = buildSupabaseRestUrl(
      "/" + encodeURIComponent(table) + "?select=*&order=created_at.desc"
    );
    if (!url) {
      return Promise.reject(
        new Error("尚未配置 Supabase（js/sync-config.js）。")
      );
    }
    return fetch(url, {
      method: "GET",
      headers: supabaseHeaders(secret),
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) {
        var err = new Error("口令错误或无权限。");
        err.code = "AUTH";
        throw err;
      }
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error("Supabase HTTP " + r.status + (t ? " " + t : ""));
        });
      }
      return r.json();
    });
  }

  // ─── 状态：当前已加载的报名行 ───────────────────────────────
  var state = {
    rows: [],
    sortKey: "created_at",
    sortDir: "desc",
    showIdCard: false,
    keyword: "",
  };

  function isLoggedIn() {
    return !!getSecret();
  }

  function showDashboard(show) {
    if ($("admin-login")) $("admin-login").hidden = show;
    if ($("admin-dashboard")) $("admin-dashboard").hidden = !show;
  }

  function refreshQuotaUI() {
    var ts = window.TangkaSite;
    if (!ts) return;
    var rem = $("adm-remaining");
    var open = $("adm-open");
    if (rem) rem.textContent = String(ts.readRemaining());
    if (open) open.textContent = ts.isRegistrationOpen() ? "开放中" : "已关闭";
  }

  // ─── 工具 ────────────────────────────────────────────────────
  function formatDateTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    function pad(n) {
      return n < 10 ? "0" + n : "" + n;
    }
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function isToday(iso) {
    if (!iso) return false;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  function escapeHtml(v) {
    if (v == null) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function healthBadge(row) {
    var ok =
      row.health_family === true &&
      row.health_body === true &&
      row.health_rules === true;
    return ok
      ? '<span class="reg-health reg-health--ok" title="家属同意 / 身体健康 / 知晓规则 全部勾选">齐</span>'
      : '<span class="reg-health reg-health--warn" title="部分声明未勾选">缺</span>';
  }

  function csvEscape(val) {
    var s = val == null ? "" : String(val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // ─── 报名总览渲染 ────────────────────────────────────────────
  function applyFilters(rows) {
    var kw = state.keyword.trim().toLowerCase();
    var filtered = rows;
    if (kw) {
      filtered = rows.filter(function (r) {
        return [r.name, r.phone, r.wechat, r.email, r.city]
          .map(function (x) {
            return String(x || "").toLowerCase();
          })
          .some(function (x) {
            return x.indexOf(kw) !== -1;
          });
      });
    }
    var key = state.sortKey;
    var dir = state.sortDir === "asc" ? 1 : -1;
    var sorted = filtered.slice().sort(function (a, b) {
      var av = a[key];
      var bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv), "zh") * dir;
    });
    return sorted;
  }

  function renderStats() {
    var total = state.rows.length;
    var today = state.rows.filter(function (r) {
      return isToday(r.created_at);
    }).length;
    var last = state.rows.length
      ? formatDateTime(
          state.rows.reduce(function (best, r) {
            return !best || new Date(r.created_at) > new Date(best.created_at)
              ? r
              : best;
          }, null).created_at
        )
      : "—";
    if ($("adm-stat-total")) $("adm-stat-total").textContent = String(total);
    if ($("adm-stat-today")) $("adm-stat-today").textContent = String(today);
    if ($("adm-stat-last")) $("adm-stat-last").textContent = last;
  }

  function renderRows() {
    var tbody = $("adm-reg-tbody");
    var emptyEl = $("adm-reg-empty");
    if (!tbody) return;
    var rows = applyFilters(state.rows);

    if (!rows.length) {
      tbody.innerHTML = "";
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = state.keyword
          ? "没有匹配到报名记录。"
          : "暂无报名记录。";
      }
    } else if (emptyEl) {
      emptyEl.hidden = true;
    }

    var html = rows
      .map(function (r) {
        var idDisplay = state.showIdCard
          ? escapeHtml(r.id_card || "")
          : "尾号" + escapeHtml(r.id_last6 || "—");
        return (
          "<tr>" +
          "<td class=\"reg-cell-time\">" +
          escapeHtml(formatDateTime(r.created_at)) +
          "</td>" +
          "<td class=\"reg-cell-name\">" +
          escapeHtml(r.name) +
          "</td>" +
          "<td><a href=\"tel:" +
          escapeHtml(r.phone) +
          "\">" +
          escapeHtml(r.phone) +
          "</a></td>" +
          "<td>" +
          escapeHtml(r.wechat) +
          "</td>" +
          "<td><a href=\"mailto:" +
          escapeHtml(r.email) +
          "\">" +
          escapeHtml(r.email) +
          "</a></td>" +
          "<td>" +
          escapeHtml(r.age) +
          "</td>" +
          "<td>" +
          escapeHtml(r.gender || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(r.city || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(r.art_base || "—") +
          "</td>" +
          "<td>" +
          healthBadge(r) +
          "</td>" +
          "<td class=\"reg-cell-id\">" +
          idDisplay +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    tbody.innerHTML = html;

    var ths = document.querySelectorAll("#adm-reg-table thead th[data-sort-key]");
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      th.classList.remove("is-sort-asc", "is-sort-desc");
      if (th.getAttribute("data-sort-key") === state.sortKey) {
        th.classList.add(
          state.sortDir === "asc" ? "is-sort-asc" : "is-sort-desc"
        );
      }
    }
  }

  function showRegStatus(msg, kind) {
    var el = $("adm-reg-status");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.className =
      "reg-status" +
      (kind === "error" ? " reg-status--error" : "") +
      (kind === "loading" ? " reg-status--loading" : "");
    el.hidden = false;
  }

  function loadRegistrations() {
    var secret = getSecret();
    if (!secret) return Promise.resolve();
    showRegStatus("正在加载报名数据…", "loading");
    return verifyAdminSecret(secret)
      .then(function () {
        return fetchRegistrations(secret);
      })
      .then(function (rows) {
        state.rows = Array.isArray(rows) ? rows : [];
        renderStats();
        renderRows();
        showRegStatus("");
      })
      .catch(function (err) {
        if (err && err.code === "AUTH") {
          handleLogout();
          var lerr = $("adm-login-error");
          if (lerr) {
            lerr.textContent = "口令已失效，请重新登录。";
            lerr.hidden = false;
          }
          return;
        }
        state.rows = [];
        renderStats();
        renderRows();
        showRegStatus(
          "拉取报名数据失败：" + (err && err.message ? err.message : err),
          "error"
        );
      });
  }

  function downloadAllCsv() {
    if (!state.rows.length) {
      alert("当前没有报名数据可导出。");
      return;
    }
    var headers = [
      "提交时间",
      "姓名",
      "手机",
      "微信",
      "邮箱",
      "年龄",
      "性别",
      "城市",
      "绘画基础",
      "家属同意",
      "身体声明",
      "知晓规则",
      "身份证号",
      "身份证后6位",
      "身份证SHA256",
    ];
    var lines = [headers.map(csvEscape).join(",")];
    state.rows.forEach(function (r) {
      lines.push(
        [
          formatDateTime(r.created_at),
          r.name,
          r.phone,
          r.wechat,
          r.email,
          r.age,
          r.gender,
          r.city,
          r.art_base,
          r.health_family ? "是" : "否",
          r.health_body ? "是" : "否",
          r.health_rules ? "是" : "否",
          r.id_card,
          r.id_last6,
          r.id_hash,
        ]
          .map(csvEscape)
          .join(",")
      );
    });
    var csvBody = lines.join("\r\n");
    var blob = new Blob(["\ufeff" + csvBody], {
      type: "text/csv;charset=utf-8",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    function pad(n) {
      return n < 10 ? "0" + n : "" + n;
    }
    a.href = url;
    a.download =
      "tangka-baoming-" +
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "-" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      ".csv";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── 登录 / 退出 ─────────────────────────────────────────────
  function handleLogin(secret) {
    var lerr = $("adm-login-error");
    if (lerr) lerr.hidden = true;
    if (!secret) {
      if (lerr) {
        lerr.textContent = "请输入管理口令。";
        lerr.hidden = false;
      }
      return;
    }
    verifyAdminSecret(secret)
      .then(function () {
        return fetchRegistrations(secret);
      })
      .then(function (rows) {
        setSecret(secret);
        state.rows = Array.isArray(rows) ? rows : [];
        showDashboard(true);
        renderStats();
        renderRows();
        refreshQuotaUI();
        showRegStatus("");
      })
      .catch(function (err) {
        if (err && err.code === "AUTH") {
          if (lerr) {
            lerr.textContent = "口令错误，请重试。";
            lerr.hidden = false;
          }
          return;
        }
        if (lerr) {
          lerr.textContent =
            "无法连接 Supabase：" + (err && err.message ? err.message : err);
          lerr.hidden = false;
        }
      });
  }

  function handleLogout() {
    setSecret("");
    state.rows = [];
    showDashboard(false);
    var pw = $("adm-password");
    if (pw) pw.value = "";
  }

  // ─── TSV → 学员 JSON 片段（保留辅助功能） ────────────────────
  function maskPhoneMiddle(phone) {
    var p = String(phone || "").replace(/\D/g, "");
    if (p.length === 11) return p.slice(0, 3) + "****" + p.slice(7);
    return p || "—";
  }

  function tryBuildStudentJsonFromTsv() {
    var ta = $("adm-tsv-input");
    var out = $("adm-json-output");
    if (!ta || !out) return;
    var line = ta.value.trim();
    if (!line) {
      out.textContent = "请先粘贴一行 TSV（与腾讯表格列序一致）。";
      return;
    }
    var td = window.TangkaTencentDocs;
    if (!td || !td.parseSheetRow) {
      out.textContent = "缺少 tencent-docs-sync.js";
      return;
    }
    var parsed = td.parseSheetRow(line);
    if (!parsed.ok) {
      out.textContent = parsed.error || "解析失败";
      return;
    }
    var f = parsed.fields;
    var idCard = String(f.idCard || "").replace(/\s/g, "").toUpperCase();
    var last6 = idCard.length >= 6 ? idCard.slice(-6) : "";

    var stub = {
      _说明:
        "将下列对象合并入 data/students.json 的 students 数组；currentStatus 请按实际改为 confirmed / waitlist / not_enrolled",
      name: f.name,
      idLast6: last6,
      idHash: f.idSha256 || "",
      phone: maskPhoneMiddle(f.phone),
      wechat: f.wechat,
      currentCourseId: "2026-04",
      currentStatus: "confirmed",
      courseHistory: ["2026-04"],
      courseCount: 1,
    };
    out.textContent = JSON.stringify(stub, null, 2);
  }

  // ─── 启动 ────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    var loginForm = $("admin-login-form");
    var logoutBtn = $("adm-logout");

    if (isLoggedIn()) {
      showDashboard(true);
      refreshQuotaUI();
      loadRegistrations();
    } else {
      showDashboard(false);
    }

    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var pw = $("adm-password");
        handleLogin((pw && pw.value) || "");
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }

    var btnRefresh = $("adm-btn-refresh");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", function () {
        loadRegistrations();
      });
    }

    var search = $("adm-search");
    if (search) {
      search.addEventListener("input", function () {
        state.keyword = search.value || "";
        renderRows();
      });
    }

    var showId = $("adm-show-idcard");
    if (showId) {
      showId.addEventListener("change", function () {
        state.showIdCard = !!showId.checked;
        renderRows();
      });
    }

    var btnDl = $("adm-btn-download-all");
    if (btnDl) btnDl.addEventListener("click", downloadAllCsv);

    var ths = document.querySelectorAll("#adm-reg-table thead th[data-sort-key]");
    for (var i = 0; i < ths.length; i++) {
      (function (th) {
        th.addEventListener("click", function () {
          var key = th.getAttribute("data-sort-key");
          if (state.sortKey === key) {
            state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
          } else {
            state.sortKey = key;
            state.sortDir = key === "created_at" ? "desc" : "asc";
          }
          renderRows();
        });
      })(ths[i]);
    }

    // 名额与开关（保留旧逻辑）
    var btnClose = $("adm-btn-close");
    var btnOpen = $("adm-btn-open");
    var btnReset = $("adm-btn-reset-quota");
    var btnSaveRem = $("adm-btn-save-remaining");
    var ts = window.TangkaSite;

    if (btnClose && ts) {
      btnClose.addEventListener("click", function () {
        ts.storageSet(ts.STORAGE_OPEN, "0");
        refreshQuotaUI();
      });
    }
    if (btnOpen && ts) {
      btnOpen.addEventListener("click", function () {
        ts.storageSet(ts.STORAGE_OPEN, "1");
        refreshQuotaUI();
      });
    }
    if (btnReset && ts) {
      btnReset.addEventListener("click", function () {
        ts.storageSet(ts.STORAGE_REMAINING, String(ts.DEFAULT_TOTAL));
        refreshQuotaUI();
      });
    }
    if (btnSaveRem && ts) {
      btnSaveRem.addEventListener("click", function () {
        var inp = $("adm-remaining-input");
        var n = inp ? parseInt(inp.value, 10) : NaN;
        if (!Number.isFinite(n) || n < 0) {
          alert("请输入不小于 0 的整数。");
          return;
        }
        ts.storageSet(ts.STORAGE_REMAINING, String(n));
        refreshQuotaUI();
      });
    }

    var btnPreview = $("adm-btn-tsv-preview");
    if (btnPreview) {
      btnPreview.addEventListener("click", tryBuildStudentJsonFromTsv);
    }
  });
})();
