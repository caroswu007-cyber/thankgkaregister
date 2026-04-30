/**
 * 管理员后台：登录、名额与开关、腾讯表格行 → 学员 JSON 片段预览
 */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function getCfg() {
    return window.TangkaAdminConfig || {};
  }

  function isLoggedIn() {
    try {
      return sessionStorage.getItem(getCfg().sessionKey || "tangka_admin_ok") === "1";
    } catch (e) {
      return false;
    }
  }

  function setLoggedIn(ok) {
    try {
      if (ok) sessionStorage.setItem(getCfg().sessionKey || "tangka_admin_ok", "1");
      else sessionStorage.removeItem(getCfg().sessionKey || "tangka_admin_ok");
    } catch (ignore) {}
  }

  function refreshQuotaUI() {
    var ts = window.TangkaSite;
    if (!ts) return;
    var rem = $("adm-remaining");
    var open = $("adm-open");
    if (rem) rem.textContent = String(ts.readRemaining());
    if (open) open.textContent = ts.isRegistrationOpen() ? "开放中" : "已关闭";
  }

  function showDashboard(show) {
    $("admin-login") && ($("admin-login").hidden = show);
    $("admin-dashboard") && ($("admin-dashboard").hidden = !show);
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
      _说明: "将下列对象合并入 data/students.json 的 students 数组；currentStatus 请按实际改为 confirmed / waitlist / not_enrolled",
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

  function maskPhoneMiddle(phone) {
    var p = String(phone || "").replace(/\D/g, "");
    if (p.length === 11) return p.slice(0, 3) + "****" + p.slice(7);
    return p || "—";
  }

  /** CSV 单元格转义（RFC 4180 风格） */
  function csvEscapeCell(val) {
    var s = String(val == null ? "" : val);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /**
   * 多行 TSV → 带 BOM 的 UTF-8 CSV，供腾讯表格「导入」
   */
  function downloadTencentCsvFromBatchTsv() {
    var ta = $("adm-tsv-batch");
    if (!ta) return;
    var raw = ta.value || "";
    var lines = raw
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    if (!lines.length) {
      alert("请先粘贴至少一行 TSV 数据。");
      return;
    }
    var td = window.TangkaTencentDocs;
    if (!td || !td.SHEET_HEADERS) {
      alert("缺少 tencent-docs-sync.js");
      return;
    }
    var headers = td.SHEET_HEADERS;
    var nCol = headers.length;
    var csvRows = [];
    csvRows.push(headers.map(csvEscapeCell).join(","));

    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split("\t");
      if (parts.length < nCol) {
        alert(
          "第 " +
            (i + 1) +
            " 行列数为 " +
            parts.length +
            "，需要至少 " +
            nCol +
            " 列（与表头一致）。请检查是否整行复制。"
        );
        return;
      }
      csvRows.push(
        parts
          .slice(0, nCol)
          .map(csvEscapeCell)
          .join(",")
      );
    }

    var csvBody = csvRows.join("\r\n");
    var blob = new Blob(["\ufeff" + csvBody], {
      type: "text/csv;charset=utf-8",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var fname =
      "tangka-baoming-" +
      d.getFullYear() +
      "-" +
      (m < 10 ? "0" : "") +
      m +
      "-" +
      (day < 10 ? "0" : "") +
      day +
      ".csv";
    a.href = url;
    a.download = fname;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var loginForm = $("admin-login-form");
    var logoutBtn = $("adm-logout");
    var dash = $("admin-dashboard");

    if (isLoggedIn()) {
      showDashboard(true);
      refreshQuotaUI();
    } else {
      showDashboard(false);
    }

    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var pw = ($("adm-password") && $("adm-password").value) || "";
        var expect = (getCfg().password || "").trim();
        if (pw === expect && expect.length > 0) {
          setLoggedIn(true);
          showDashboard(true);
          refreshQuotaUI();
          var err = $("adm-login-error");
          if (err) err.hidden = true;
        } else {
          var er = $("adm-login-error");
          if (er) {
            er.textContent = "口令错误或未在 admin-config.js 中配置。";
            er.hidden = false;
          }
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        setLoggedIn(false);
        showDashboard(false);
      });
    }

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

    var btnCsv = $("adm-btn-download-csv");
    if (btnCsv) {
      btnCsv.addEventListener("click", downloadTencentCsvFromBatchTsv);
    }

    if (dash && !dash.hidden) refreshQuotaUI();
  });
})();
