/**
 * 报名表单：校验、SHA-256、可选 Supabase 自动归档、EmailJS 双发
 */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function validateChineseIdCard(id) {
    var s = String(id || "")
      .trim()
      .toUpperCase();
    if (!/^\d{17}[\dX]$/.test(s)) return false;
    var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    var checkCodes = "10X98765432";
    var sum = 0;
    for (var i = 0; i < 17; i++) {
      sum += parseInt(s.charAt(i), 10) * weights[i];
    }
    var idx = sum % 11;
    return checkCodes.charAt(idx) === s.charAt(17);
  }

  function validatePhone(p) {
    return /^1\d{10}$/.test(String(p || "").trim());
  }

  function validateEmail(val) {
    var v = String(val || "").trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function byteToHex(b) {
    var h = b.toString(16);
    return h.length === 1 ? "0" + h : h;
  }

  function sha256HexSafe(text) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error("当前环境不支持 SHA-256"));
    }
    var buf = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", buf).then(function (hash) {
      var bytes = new Uint8Array(hash);
      var out = "";
      for (var i = 0; i < bytes.length; i++) out += byteToHex(bytes[i]);
      return out;
    });
  }

  function isEmailConfigured() {
    var c = window.TangkaEmailConfig;
    if (!c) return false;
    function ok(v) {
      return v && String(v).indexOf("YOUR_") === -1;
    }
    return (
      ok(c.publicKey) &&
      ok(c.serviceId) &&
      ok(c.templateApplicant) &&
      ok(c.templateAdmin)
    );
  }

  function clearFieldErrors() {
    var nodes = document.querySelectorAll(".field-error");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = "";
      nodes[i].hidden = true;
    }
    var top = $("form-error-top");
    if (top) {
      top.textContent = "";
      top.hidden = true;
    }
  }

  function showFieldError(fieldId, msg) {
    var el = $("err-" + fieldId);
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    }
  }

  function showTopError(msg) {
    var top = $("form-error-top");
    if (top) {
      top.textContent = msg;
      top.hidden = false;
    }
  }

  function buildAdminPlain(cfg, data, idSha256) {
    var lines = [
      "【新报名】" + cfg.courseName,
      "提交时间：" + data.submittedAt,
      "",
      "姓名：" + data.name,
      "手机号：" + data.phone,
      "微信号：" + data.wechat,
      "邮箱：" + data.email,
      "年龄：" + data.age,
      "性别：" + data.gender,
      "城市：" + data.city,
      "绘画基础：" + data.artBase,
      "身份证号：" + data.idCard,
      "身份证SHA256：" + idSha256,
      "",
      "健康声明（家属同意 / 身体声明 / 知晓规则）：",
      data.healthFamily ? "✓ 已征得家属同意" : "✗",
      data.healthBody ? "✓ 身体健康声明" : "✗",
      data.healthRules ? "✓ 知晓活动规则" : "✗",
      "",
      "—— 以下为腾讯表格粘贴行（Tab 分隔）——",
      window.TangkaTencentDocs.buildHeadersLine(),
      window.TangkaTencentDocs.buildPasteRow(
        Object.assign({}, data, { idSha256: idSha256 })
      ),
    ];
    return lines.join("\n");
  }

  function collectAndValidate() {
    var name = ($("field-name") && $("field-name").value.trim()) || "";
    var idCard =
      ($("field-id-card") && $("field-id-card").value.trim().toUpperCase()) ||
      "";
    var phone = ($("field-phone") && $("field-phone").value.trim()) || "";
    var wechat = ($("field-wechat") && $("field-wechat").value.trim()) || "";
    var ageRaw = ($("field-age") && $("field-age").value.trim()) || "";
    var email = ($("field-email") && $("field-email").value.trim()) || "";
    var city = ($("field-city") && $("field-city").value.trim()) || "";

    var genderEl = document.querySelector('input[name="gender"]:checked');
    var gender = genderEl ? genderEl.value : "";

    var artEl = document.querySelector('input[name="art_base"]:checked');
    var artBase = artEl ? artEl.value : "";

    var healthFamily = $("health-family") && $("health-family").checked;
    var healthBody = $("health-body") && $("health-body").checked;
    var healthRules = $("health-rules") && $("health-rules").checked;

    var ok = true;

    if (!name) {
      showFieldError("name", "请填写姓名");
      ok = false;
    }
    if (!validateChineseIdCard(idCard)) {
      showFieldError("id-card", "请输入正确的 18 位身份证号码");
      ok = false;
    }
    if (!validatePhone(phone)) {
      showFieldError("phone", "请输入 11 位中国大陆手机号");
      ok = false;
    }
    if (!wechat) {
      showFieldError("wechat", "请填写微信号");
      ok = false;
    }
    var age = parseInt(ageRaw, 10);
    if (!Number.isFinite(age) || age < 16) {
      showFieldError("age", "年龄须为不少于 16 周岁的整数");
      ok = false;
    }
    if (!validateEmail(email)) {
      showFieldError("email", "请填写有效电子邮箱");
      ok = false;
    }
    if (!gender) {
      showFieldError("gender", "请选择性别");
      ok = false;
    }
    if (!city) {
      showFieldError("city", "请填写所在城市");
      ok = false;
    }
    if (!artBase) {
      showFieldError("art-base", "请选择是否有绘画基础");
      ok = false;
    }
    if (!healthFamily || !healthBody || !healthRules) {
      showFieldError("health", "请勾选全部健康与知情声明");
      ok = false;
    }

    if (!ok) return null;

    return {
      name: name,
      idCard: idCard,
      phone: phone,
      wechat: wechat,
      age: age,
      email: email,
      gender: gender,
      city: city,
      artBase: artBase,
      healthFamily: healthFamily,
      healthBody: healthBody,
      healthRules: healthRules,
      submittedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
  }

  function bindRegisterPage() {
    var closedPanel = $("register-closed");
    var form = $("register-form");
    var cfgHint = $("emailjs-config-hint");

    if (!window.TangkaSite || !window.TangkaSite.canRegister()) {
      if (closedPanel) closedPanel.hidden = false;
      if (form) form.hidden = true;
      return;
    }

    if (closedPanel) closedPanel.hidden = true;
    if (form) form.hidden = false;

    var cfgPre = window.TangkaEmailConfig || {};
    if (cfgHint) {
      var syncOn =
        window.TangkaRegistrationSync &&
        window.TangkaRegistrationSync.isEnabled();
      cfgHint.hidden = isEmailConfigured() || syncOn;
    }

    if (
      cfgPre &&
      isEmailConfigured() &&
      typeof emailjs !== "undefined"
    ) {
      emailjs.init({ publicKey: cfgPre.publicKey });
    }

    var formEl = $("register-form");
    if (!formEl) return;

    function finishSuccess(data) {
      try {
        window.TangkaSite.decrementRemaining(1);
      } catch (ignore) {}
      sessionStorage.setItem("tangka_reg_success", "1");
      sessionStorage.setItem("tangka_reg_display_name", data.name);
      window.location.href = "success.html";
    }

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      clearFieldErrors();

      if (!window.TangkaSite.canRegister()) {
        showTopError("当前暂不开放报名或名额已满。");
        return;
      }

      var cfg = window.TangkaEmailConfig || {};
      var syncOk =
        window.TangkaRegistrationSync &&
        window.TangkaRegistrationSync.isEnabled();

      function canSubmitOutbound() {
        if (isEmailConfigured()) return true;
        if (syncOk) return true;
        return false;
      }

      if (!canSubmitOutbound()) {
        showTopError(
          "当前提交通道暂不可用，请稍后再试或联系工作人员。"
        );
        return;
      }

      if (isEmailConfigured() && typeof emailjs === "undefined") {
        showTopError("未能加载 EmailJS 脚本，请检查网络后重试。");
        return;
      }

      var data = collectAndValidate();
      if (!data) return;

      var btn = $("btn-submit");
      var td = window.TangkaTencentDocs;

      function setLoading(loading) {
        if (btn) {
          btn.disabled = loading;
          btn.textContent = loading ? "提交中…" : "提交报名";
        }
      }

      function formatSubmitError(err) {
        if (!err) return "未知错误";
        if (typeof err.text === "string" && err.text) return err.text;
        if (err.status && err.text)
          return "HTTP " + err.status + " " + err.text;
        if (err.message) return String(err.message);
        return String(err);
      }

      function sendApplicantEmail(hash) {
        if (!isEmailConfigured()) return Promise.resolve();
        var applicantParams = {
          to_email: data.email,
          user_name: data.name,
          user_email: data.email,
          course_name: cfg.courseName,
          course_dates: cfg.courseDates,
          course_place: cfg.coursePlace,
          tips_short:
            "请查收本邮件；可同时留意手机短信与微信「升莲」好友通知（若有）。",
        };
        return emailjs.send(
          cfg.serviceId,
          cfg.templateApplicant,
          applicantParams
        );
      }

      function sendAdminEmail(hash) {
        if (!isEmailConfigured()) return Promise.resolve();
        var sheetRow = td.buildPasteRow(
          Object.assign({}, data, { idSha256: hash })
        );
        var headersLine = td.buildHeadersLine();
        var adminPlain = buildAdminPlain(cfg, data, hash);
        var phoneTail =
          data.phone.length >= 4 ? data.phone.slice(-4) : data.phone;
        var adminNotify = String(cfg.adminNotifyEmail || "").trim();
        var adminParams = {
          admin_subject_hint: data.name + " · 尾号" + phoneTail,
          sheet_headers_line: headersLine,
          sheet_row_line: sheetRow,
          admin_plain: adminPlain,
          reply_to: data.email,
        };
        if (adminNotify) {
          adminParams.to_email = adminNotify;
        }
        return emailjs.send(cfg.serviceId, cfg.templateAdmin, adminParams);
      }

      function sendEmailsSequentially(hash) {
        if (!isEmailConfigured()) return Promise.resolve();
        return sendApplicantEmail(hash)
          .catch(function (e) {
            e._tangkaStage = "applicant";
            throw e;
          })
          .then(function () {
            return sendAdminEmail(hash).catch(function (e) {
              e._tangkaStage = "admin";
              throw e;
            });
          });
      }

      setLoading(true);

      sha256HexSafe(data.idCard)
        .then(function (hash) {
          var tasks = [];
          if (syncOk) {
            tasks.push(
              window.TangkaRegistrationSync.submitRegistration(data, hash)
            );
          }
          if (isEmailConfigured()) {
            tasks.push(sendEmailsSequentially(hash));
          }
          if (!tasks.length) {
            return Promise.reject(new Error("未配置可用的提交通道"));
          }
          return Promise.all(tasks).then(function () {
            finishSuccess(data);
          });
        })
        .catch(function (err) {
          var raw = formatSubmitError(err);
          var msg = "提交失败：" + raw;
          if (err && err._tangkaStage === "admin") {
            msg =
              "报名者确认邮件已发出，但管理员通知失败：" +
              raw +
              "。请检查管理员模板、收件人字段（如 {{to_email}}）及 adminNotifyEmail 配置。";
          }
          showTopError(
            msg +
              "（邮件模板变量、Supabase 表字段名或 RLS 策略请对照文档检查）"
          );
        })
        .finally(function () {
          setLoading(false);
        });
    });
  }

  document.addEventListener("DOMContentLoaded", bindRegisterPage);
})();
