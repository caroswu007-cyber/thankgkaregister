/**
 * 学员查询：优先腾讯文档智能表（经 server POST /query），其次 Supabase RPC，否则 data/students.json
 */
(function () {
  "use strict";

  var DATA_URL = "data/students.json";

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeName(s) {
    return String(s || "").trim();
  }

  function normalizeLast6(s) {
    var d = String(s || "").replace(/\D/g, "");
    if (d.length >= 6) return d.slice(-6);
    return d;
  }

  function normalizeIdTail(s, idType) {
    var raw = String(s || "").trim().toUpperCase();
    if (idType === "身份证") return normalizeLast6(raw);
    raw = raw.replace(/\s/g, "");
    return raw.length >= 6 ? raw.slice(-6) : raw;
  }

  function resolveTencentQueryUrl() {
    var qc = window.TangkaQueryConfig || {};
    var u = qc.tencentQueryUrl;
    if (u && String(u).indexOf("http") === 0) {
      return String(u).replace(/\/$/, "");
    }
    var sc = window.TangkaSyncConfig || {};
    var a = sc.tencentProxyUrl;
    if (a && String(a).indexOf("http") === 0) {
      var t = String(a).replace(/\/$/, "");
      if (t.length >= 7 && t.slice(-7) === "/append") {
        return t.slice(0, -7) + "/query";
      }
      return t + "/query";
    }
    return "";
  }

  function queryWebhookSecret() {
    var qc = window.TangkaQueryConfig || {};
    if (qc.tencentQuerySecret) return qc.tencentQuerySecret;
    var sc = window.TangkaSyncConfig || {};
    return sc.tencentProxySecret || "";
  }

  function fetchTencentQuery(baseUrl, name, idType, last6) {
    return fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": queryWebhookSecret(),
      },
      body: JSON.stringify({ name: name, id_type: idType, id_last6: last6 }),
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try {
          j = JSON.parse(t || "{}");
        } catch (ignore) {}
        if (r.status === 409) {
          var err = new Error(j.message || "存在多条匹配记录，请联系工作人员核实。");
          err.code = "ambiguous";
          throw err;
        }
        if (!r.ok) {
          throw new Error(j.error || t || "查询接口 HTTP " + r.status);
        }
        return j;
      });
    });
  }

  function supabaseHeaders(apiKey) {
    var k = String(apiKey || "");
    var h = {
      "Content-Type": "application/json",
      apikey: k,
    };
    if (k.indexOf("eyJ") === 0) {
      h.Authorization = "Bearer " + k;
    }
    return h;
  }

  function resolveSupabaseRpcUrl() {
    var sc = window.TangkaSyncConfig || {};
    if (
      !sc.supabaseUrl ||
      String(sc.supabaseUrl).indexOf("http") !== 0 ||
      !sc.supabaseAnonKey
    ) {
      return "";
    }
    var base = String(sc.supabaseUrl).replace(/\/$/, "");
    if (base.indexOf("/rest/v1/") !== -1) {
      base = base.replace(/\/rest\/v1\/?.*$/, "");
    }
    return base + "/rest/v1/rpc/query_registration_status";
  }

  function fetchSupabaseQuery(name, idType, last6) {
    var sc = window.TangkaSyncConfig || {};
    var url = resolveSupabaseRpcUrl();
    if (!url) return Promise.reject(new Error("未配置 Supabase 查询"));

    return fetch(url, {
      method: "POST",
      headers: supabaseHeaders(sc.supabaseAnonKey),
      body: JSON.stringify({
        q_name: name,
        q_id_type: idType,
        q_id_last6: last6,
      }),
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try {
          j = JSON.parse(t || "null");
        } catch (ignore) {}
        if (!r.ok) {
          var msg =
            (j && (j.message || j.error)) ||
            t ||
            "Supabase 查询接口 HTTP " + r.status;
          if (r.status === 404 || String(msg).indexOf("Could not find") !== -1) {
            msg =
              "Supabase 查询函数尚未更新，请先在 Supabase SQL Editor 执行 scripts/supabase-registrations.sql 的最新版。";
          }
          throw new Error(msg);
        }
        return Array.isArray(j) ? j : [];
      });
    });
  }

  function renderTencentResults(api) {
    var s = api.student || {};
    $("res-name").textContent = s.name || "—";
    $("res-status").textContent = api.statusDisplay || "已在腾讯文档登记";
    $("res-count").textContent = "—";
    var hist = "以腾讯文档登记表为准";
    if (s.submittedAt) {
      hist = "提交时间：" + s.submittedAt;
    }
    $("res-history").textContent = hist;
    $("res-phone").textContent = s.phone || "—";
    $("res-wechat").textContent = s.wechat || "—";
    $("res-current-course").textContent = api.currentCourseLine || "—";

    setVisible("query-results", true);
    setVisible("query-empty", false);
    setVisible("query-error", false);
  }

  function renderSupabaseResults(rows) {
    if (!rows || !rows.length) {
      showNotFound();
      return;
    }
    if (rows.length > 1) {
      showError("存在多条匹配记录，请联系工作人员核实。");
      return;
    }

    var s = rows[0] || {};
    $("res-name").textContent = s.name || "—";
    $("res-status").textContent = s.status_display || "已提交报名";
    $("res-count").textContent = "1";
    $("res-history").textContent = s.submitted_at
      ? "提交时间：" + String(s.submitted_at).replace("T", " ").slice(0, 19)
      : "已在报名系统登记";
    $("res-phone").textContent = s.phone || "—";
    $("res-wechat").textContent = s.wechat || "—";
    $("res-current-course").textContent =
      s.current_course_line || "唐卡传承公益体验课";

    setVisible("query-results", true);
    setVisible("query-empty", false);
    setVisible("query-error", false);
  }

  function statusLabel(code) {
    if (code === "confirmed") return "已确认报名";
    if (code === "waitlist") return "候补";
    if (code === "not_enrolled") return "未报名本期";
    return String(code || "—");
  }

  function courseById(courses, id) {
    for (var i = 0; i < courses.length; i++) {
      if (courses[i].id === id) return courses[i];
    }
    return null;
  }

  function formatHistoryList(courses, historyIds) {
    if (!historyIds || !historyIds.length) return "暂无记录";
    var lines = [];
    for (var i = 0; i < historyIds.length; i++) {
      var c = courseById(courses, historyIds[i]);
      if (c) lines.push(c.name + "（" + c.date + "）");
      else lines.push(historyIds[i]);
    }
    return lines.join("；");
  }

  function findMatches(data, name, idType, last6) {
    var list = (data && data.students) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var sameType = !s.idType || s.idType === idType;
      if (normalizeName(s.name) === name && sameType && String(s.idLast6 || "") === last6) {
        out.push(s);
      }
    }
    return out;
  }

  function setVisible(id, show) {
    var el = $(id);
    if (el) el.hidden = !show;
  }

  function renderResults(data, student) {
    var courses = data.courses || [];
    var curId = data.currentCourseId;
    var curCourse = courseById(courses, curId);

    $("res-name").textContent = student.name;
    $("res-status").textContent = statusLabel(student.currentStatus);
    $("res-count").textContent = String(
      student.courseCount != null
        ? student.courseCount
        : (student.courseHistory || []).length
    );
    $("res-history").textContent = formatHistoryList(courses, student.courseHistory || []);
    $("res-phone").textContent = student.phone || "—";
    $("res-wechat").textContent = student.wechat || "—";

    var curLine = "—";
    if (curCourse) {
      curLine = curCourse.name + "（" + curCourse.date + "）";
    }
    $("res-current-course").textContent = curLine;

    setVisible("query-results", true);
    setVisible("query-empty", false);
    setVisible("query-error", false);
  }

  function showError(msg) {
    setVisible("query-results", false);
    setVisible("query-empty", false);
    var el = $("query-error");
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    }
  }

  function showNotFound() {
    setVisible("query-results", false);
    setVisible("query-error", false);
    setVisible("query-empty", true);
  }

  function hideAllPanels() {
    setVisible("query-results", false);
    setVisible("query-empty", false);
    setVisible("query-error", false);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("query-form");
    if (!form) return;

    var typeEl = $("q-id-type");
    var tailEl = $("q-last6");

    function syncTailField() {
      var idType = (typeEl && typeEl.value) || "身份证";
      if (!tailEl) return;
      if (idType === "身份证") {
        tailEl.placeholder = "身份证后 6 位数字";
        tailEl.inputMode = "numeric";
        tailEl.pattern = "[0-9]{6}";
      } else {
        tailEl.placeholder = "证件号码后 6 位";
        tailEl.inputMode = "text";
        tailEl.removeAttribute("pattern");
      }
    }

    if (typeEl) typeEl.addEventListener("change", syncTailField);
    syncTailField();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideAllPanels();

      var name = normalizeName($("q-name") && $("q-name").value);
      var idType = ($("q-id-type") && $("q-id-type").value) || "身份证";
      var last6 = normalizeIdTail($("q-last6") && $("q-last6").value, idType);

      if (!name) {
        showError("请填写姓名。");
        return;
      }
      if (last6.length !== 6 || (idType === "身份证" && !/^\d{6}$/.test(last6))) {
        showError(
          idType === "身份证"
            ? "请填写身份证后 6 位数字。"
            : "请填写证件号码后 6 位。"
        );
        return;
      }

      var btn = $("q-submit");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "查询中…";
      }

      var tencentBase = resolveTencentQueryUrl();
      var chain;

      if (tencentBase) {
        chain = fetchTencentQuery(tencentBase, name, idType, last6).then(function (api) {
          if (!api.ok) {
            throw new Error(api.error || "查询失败");
          }
          if (!api.found) {
            showNotFound();
            return;
          }
          renderTencentResults(api);
        });
      } else if (resolveSupabaseRpcUrl()) {
        chain = fetchSupabaseQuery(name, idType, last6).then(renderSupabaseResults);
      } else {
        chain = fetch(DATA_URL, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("无法加载数据文件（HTTP " + r.status + "）");
            return r.json();
          })
          .then(function (data) {
            var matches = findMatches(data, name, idType, last6);
            if (matches.length === 0) {
              showNotFound();
            } else if (matches.length > 1) {
              showError("存在多条匹配记录，请联系工作人员核实。");
            } else {
              renderResults(data, matches[0]);
            }
          });
      }

      chain
        .catch(function (err) {
          var hint =
            err && err.message
              ? err.message
              : "网络或文件读取失败。若使用本地文件打开，请用本地静态服务（如 npx serve）访问站点。";
          if (hint.indexOf("Failed to fetch") !== -1) {
            hint =
              "无法连接查询服务。请确认已部署 server 并填写 tencentProxyUrl（与 append 同源 /query），或暂时留空以使用 data/students.json。";
          }
          showError(hint);
        })
        .finally(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "查询";
          }
        });
    });
  });
})();
