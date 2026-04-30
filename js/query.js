/**
 * 学员查询：加载 data/students.json，按姓名 + 身份证后 6 位匹配
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

  function findMatches(data, name, last6) {
    var list = (data && data.students) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (normalizeName(s.name) === name && String(s.idLast6 || "") === last6) {
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
    $("res-count").textContent = String(student.courseCount != null ? student.courseCount : (student.courseHistory || []).length);
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

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideAllPanels();

      var name = normalizeName($("q-name") && $("q-name").value);
      var last6 = normalizeLast6($("q-last6") && $("q-last6").value);

      if (!name) {
        showError("请填写姓名。");
        return;
      }
      if (last6.length !== 6) {
        showError("请填写身份证后 6 位数字。");
        return;
      }

      var btn = $("q-submit");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "查询中…";
      }

      fetch(DATA_URL, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("无法加载数据文件（HTTP " + r.status + "）");
          return r.json();
        })
        .then(function (data) {
          var matches = findMatches(data, name, last6);
          if (matches.length === 0) {
            showNotFound();
          } else if (matches.length > 1) {
            showError("存在多条匹配记录，请联系工作人员核实。");
          } else {
            renderResults(data, matches[0]);
          }
        })
        .catch(function (err) {
          var hint =
            err && err.message
              ? err.message
              : "网络或文件读取失败。若使用本地文件打开，请用本地静态服务（如 npx serve）访问站点。";
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
