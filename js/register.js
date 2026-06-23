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

  function ageFromChineseId(id) {
    var s = String(id || "")
      .trim()
      .toUpperCase();
    if (!/^\d{17}[\dX]$/.test(s)) return null;
    var y = parseInt(s.substring(6, 10), 10);
    var m = parseInt(s.substring(10, 12), 10) - 1;
    var d = parseInt(s.substring(12, 14), 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return null;
    }
    var birth = new Date(y, m, d);
    if (
      birth.getFullYear() !== y ||
      birth.getMonth() !== m ||
      birth.getDate() !== d
    ) {
      return null;
    }
    var today = new Date();
    var age = today.getFullYear() - y;
    var md = today.getMonth() - m;
    if (md < 0 || (md === 0 && today.getDate() < d)) age -= 1;
    return age;
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

  function organizerEmail(cfg) {
    return String(
      (cfg && (cfg.organizerEmail || cfg.adminNotifyEmail)) || ""
    ).trim();
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

  function getIdType() {
    var el = $("field-id-type");
    return el ? String(el.value || "身份证") : "身份证";
  }

  function syncAgeFromIdCard() {
    var ageEl = $("field-age");
    var hintEl = $("age-hint");
    var idType = getIdType();
    if (!ageEl) return;

    if (idType === "身份证") {
      ageEl.readOnly = true;
      if (hintEl) {
        hintEl.textContent = "已根据身份证号码自动计算年龄。";
      }
      var idCard =
        ($("field-id-card") && $("field-id-card").value.trim().toUpperCase()) ||
        "";
      var age = ageFromChineseId(idCard);
      ageEl.value = age != null && age >= 0 ? String(age) : "";
    } else {
      ageEl.readOnly = false;
      if (hintEl) {
        hintEl.textContent = "护照或其他证件请手动填写年龄（周岁）。";
      }
    }
  }

  function syncIdCardPlaceholder() {
    var idType = getIdType();
    var input = $("field-id-card");
    if (!input) return;
    if (idType === "身份证") {
      input.placeholder = "18 位二代身份证号码";
      input.maxLength = 18;
      input.inputMode = "numeric";
    } else if (idType === "护照") {
      input.placeholder = "护照号码";
      input.maxLength = 30;
      input.inputMode = "text";
    } else {
      input.placeholder = "证件号码";
      input.maxLength = 30;
      input.inputMode = "text";
    }
  }

  function toggleLodgingSection() {
    var needs = $("field-needs-lodging") && $("field-needs-lodging").checked;
    var section = $("lodging-rules-section");
    var emergencySection = $("emergency-contact-section");
    var agree = $("agree-conduct-rules");
    var emergencyFields = [
      $("field-emergency-name"),
      $("field-emergency-phone"),
      $("field-emergency-relation"),
    ];
    if (section) section.hidden = !needs;
    if (emergencySection) emergencySection.hidden = !needs;
    if (!needs) {
      if (agree) agree.checked = false;
      emergencyFields.forEach(function (field) {
        if (field) field.value = "";
      });
      ["emergency-name", "emergency-phone", "emergency-relation"].forEach(
        function (fieldId) {
          var err = $("err-" + fieldId);
          if (err) {
            err.textContent = "";
            err.hidden = true;
          }
        }
      );
    }
  }

  function renderHealthQuestionnaire() {
    var wrap = $("health-questionnaire");
    var docs = window.TangkaRegisterDocuments;
    if (!wrap || !docs || !docs.HEALTH_QUESTIONS) return;

    var html = "";
    docs.HEALTH_QUESTIONS.forEach(function (q, idx) {
      html +=
        '<fieldset class="health-q-item" data-health-key="' +
        q.key +
        '">' +
        '<legend class="health-q-label">' +
        (idx + 1) +
        ". " +
        q.label +
        ' <span class="req">*</span></legend>' +
        '<div class="radio-row">' +
        '<label class="radio-label"><input type="radio" name="' +
        q.key +
        '" value="是" /> 是 / 有</label>' +
        '<label class="radio-label"><input type="radio" name="' +
        q.key +
        '" value="否" /> 否 / 无</label>' +
        "</div></fieldset>";
    });
    wrap.innerHTML = html;
  }

  function openHealthQuestionnaire() {
    var wrap = $("health-questionnaire");
    var confirmWrap = $("health-form-confirm-wrap");
    var btn = $("btn-open-health-form");
    if (!wrap) return;
    wrap.hidden = false;
    if (confirmWrap) confirmWrap.hidden = false;
    if (btn) btn.textContent = "已展开";
    wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function collectHealthAnswers() {
    var docs = window.TangkaRegisterDocuments;
    var out = {};
    if (!docs || !docs.HEALTH_QUESTIONS) return out;
    docs.HEALTH_QUESTIONS.forEach(function (q) {
      var el = document.querySelector('input[name="' + q.key + '"]:checked');
      out[q.key] = el ? el.value : "";
    });
    return out;
  }

  function validateHealthQuestionnaire() {
    var docs = window.TangkaRegisterDocuments;
    if (!docs || !docs.HEALTH_QUESTIONS) return true;
    for (var i = 0; i < docs.HEALTH_QUESTIONS.length; i++) {
      var key = docs.HEALTH_QUESTIONS[i].key;
      var el = document.querySelector('input[name="' + key + '"]:checked');
      if (!el) {
        showFieldError(
          "health-questionnaire",
          "请完整填写健康状况声明表（第 " + (i + 1) + " 题尚未选择）"
        );
        return false;
      }
    }
    return true;
  }

  function buildAdminPlain(cfg, data, idSha256) {
    var lines = [
      "【新报名】" + cfg.courseName,
      "提交时间：" + data.submittedAt,
      "",
      "姓名：" + data.name,
      "证件类型：" + data.idType,
      "证件号码：" + data.idCard,
      "手机号：" + data.phone,
      "微信号：" + data.wechat,
      "邮箱：" + data.email,
      "年龄：" + data.age,
      "性别：" + data.gender,
      "城市：" + data.city,
      "联系地址：" + data.contactAddress,
      "需要住宿：" + (data.needsLodging ? "是" : "否"),
      "绘画基础：" + data.artBase,
    ];
    if (data.needsLodging) {
      lines.push(
        "紧急联系人：" + data.emergencyName,
        "紧急联系人电话：" + data.emergencyPhone,
        "与申请人关系：" + data.emergencyRelation
      );
    }
    lines.push(
      "身份证SHA256：" + idSha256,
      "",
      "健康声明（家属同意 / 身体声明 / 知晓规则）：",
      data.healthFamily ? "✓ 已征得家属同意" : "✗",
      data.healthBody ? "✓ 身体健康声明" : "✗",
      data.healthRules ? "✓ 知晓活动规则" : "✗",
      "",
      "健康状况声明表："
    );
    var hq = data.healthAnswers || {};
    Object.keys(hq).forEach(function (k) {
      lines.push(k + "：" + hq[k]);
    });
    lines.push(
      "",
      "—— 以下为腾讯表格粘贴行（Tab 分隔）——",
      window.TangkaTencentDocs.buildHeadersLine(),
      window.TangkaTencentDocs.buildPasteRow(
        Object.assign({}, data, { idSha256: idSha256 })
      )
    );
    return lines.join("\n");
  }

  function collectAndValidate() {
    var name = ($("field-name") && $("field-name").value.trim()) || "";
    var idType = getIdType();
    var idCardRaw =
      ($("field-id-card") && $("field-id-card").value.trim()) || "";
    var idCard =
      idType === "身份证" ? idCardRaw.toUpperCase() : idCardRaw;
    var phone = ($("field-phone") && $("field-phone").value.trim()) || "";
    var wechat = ($("field-wechat") && $("field-wechat").value.trim()) || "";
    var ageRaw = ($("field-age") && $("field-age").value.trim()) || "";
    var email = ($("field-email") && $("field-email").value.trim()) || "";
    var city = ($("field-city") && $("field-city").value.trim()) || "";
    var contactAddress =
      ($("field-address") && $("field-address").value.trim()) || "";
    var needsLodging =
      $("field-needs-lodging") && $("field-needs-lodging").checked;
    var emergencyName =
      ($("field-emergency-name") && $("field-emergency-name").value.trim()) ||
      "";
    var emergencyPhone =
      ($("field-emergency-phone") &&
        $("field-emergency-phone").value.trim()) ||
      "";
    var emergencyRelation =
      ($("field-emergency-relation") &&
        $("field-emergency-relation").value.trim()) ||
      "";

    var genderEl = document.querySelector('input[name="gender"]:checked');
    var gender = genderEl ? genderEl.value : "";

    var artEl = document.querySelector('input[name="art_base"]:checked');
    var artBase = artEl ? artEl.value : "";

    var agreeHealthDeclaration =
      $("agree-health-declaration") && $("agree-health-declaration").checked;
    var agreeHealthQuestionnaire =
      $("agree-health-questionnaire") &&
      $("agree-health-questionnaire").checked;
    var agreeConductRules =
      $("agree-conduct-rules") && $("agree-conduct-rules").checked;

    var healthFamily = $("health-family") && $("health-family").checked;
    var healthBody = $("health-body") && $("health-body").checked;
    var healthRules = $("health-rules") && $("health-rules").checked;

    var ok = true;

    if (!name) {
      showFieldError("name", "请填写姓名");
      ok = false;
    }

    if (idType === "身份证") {
      if (!validateChineseIdCard(idCard)) {
        showFieldError("id-card", "请输入正确的 18 位身份证号码");
        ok = false;
      }
    } else if (!idCard || idCard.length < 4) {
      showFieldError("id-card", "请填写有效的证件号码");
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

    syncAgeFromIdCard();
    var age = parseInt(($("field-age") && $("field-age").value) || ageRaw, 10);
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
    if (!contactAddress) {
      showFieldError("address", "请填写联系地址");
      ok = false;
    }
    if (!artBase) {
      showFieldError("art-base", "请选择是否有绘画基础");
      ok = false;
    }
    if (needsLodging) {
      if (!emergencyName) {
        showFieldError("emergency-name", "请填写紧急联系人姓名");
        ok = false;
      }
      if (!emergencyPhone || emergencyPhone.length < 6) {
        showFieldError("emergency-phone", "请填写有效的紧急联系人电话");
        ok = false;
      }
      if (!emergencyRelation) {
        showFieldError("emergency-relation", "请填写与申请人的关系");
        ok = false;
      }
    }
    if (!agreeHealthDeclaration) {
      showFieldError(
        "health-declaration",
        "请阅读《申请者健康问题》特别声明并勾选确认"
      );
      ok = false;
    }
    if (!validateHealthQuestionnaire()) {
      ok = false;
    }
    if (!agreeHealthQuestionnaire) {
      showFieldError(
        "health-questionnaire-agree",
        "请勾选健康状况声明表底部的确认声明"
      );
      ok = false;
    }
    if (needsLodging && !agreeConductRules) {
      showFieldError(
        "conduct-rules",
        "选择住宿须阅读并同意《修行与自律 · 行为规范》"
      );
      ok = false;
    }
    if (!healthFamily || !healthBody || !healthRules) {
      showFieldError("health", "请勾选全部健康与知情声明");
      ok = false;
    }

    if (!ok) return null;

    return {
      name: name,
      idType: idType,
      idCard: idCard,
      phone: phone,
      wechat: wechat,
      age: age,
      email: email,
      gender: gender,
      city: city,
      contactAddress: contactAddress,
      needsLodging: needsLodging,
      emergencyName: emergencyName,
      emergencyPhone: emergencyPhone,
      emergencyRelation: emergencyRelation,
      artBase: artBase,
      agreeHealthDeclaration: agreeHealthDeclaration,
      agreeHealthQuestionnaire: agreeHealthQuestionnaire,
      agreeConductRules: needsLodging ? agreeConductRules : false,
      healthAnswers: collectHealthAnswers(),
      healthFamily: healthFamily,
      healthBody: healthBody,
      healthRules: healthRules,
      submittedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
  }

  function initDocuments() {
    var docs = window.TangkaRegisterDocuments;
    if (!docs) return;
    var healthDoc = $("health-declaration-doc");
    var conductDoc = $("conduct-rules-doc");
    if (healthDoc) healthDoc.innerHTML = docs.HEALTH_DECLARATION_HTML;
    if (conductDoc) conductDoc.innerHTML = docs.CONDUCT_RULES_HTML;
    renderHealthQuestionnaire();
  }

  function bindRegisterPage() {
    initDocuments();

    var closedPanel = $("register-closed");
    var form = $("register-form");

    if (closedPanel) closedPanel.hidden = true;
    if (form) form.hidden = false;

    var idTypeEl = $("field-id-type");
    var idCardEl = $("field-id-card");
    var lodgingEl = $("field-needs-lodging");
    var healthBtn = $("btn-open-health-form");

    if (idTypeEl) {
      idTypeEl.addEventListener("change", function () {
        syncIdCardPlaceholder();
        syncAgeFromIdCard();
      });
    }
    if (idCardEl) {
      idCardEl.addEventListener("input", syncAgeFromIdCard);
      idCardEl.addEventListener("blur", syncAgeFromIdCard);
    }
    if (lodgingEl) {
      lodgingEl.addEventListener("change", toggleLodgingSection);
    }
    if (healthBtn) {
      healthBtn.addEventListener("click", openHealthQuestionnaire);
    }
    var agreeHealthDoc = $("agree-health-declaration");
    if (agreeHealthDoc) {
      agreeHealthDoc.addEventListener("change", function () {
        if (agreeHealthDoc.checked) openHealthQuestionnaire();
      });
    }

    syncIdCardPlaceholder();
    syncAgeFromIdCard();
    toggleLodgingSection();

    var cfgPre = window.TangkaEmailConfig || {};
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
        var orgEmail = organizerEmail(cfg);
        var applicantParams = {
          to_email: data.email,
          user_name: data.name,
          user_email: data.email,
          course_name: cfg.courseName,
          course_dates: cfg.courseDates,
          course_place: cfg.coursePlace,
          contact_email: orgEmail,
          reply_to: orgEmail,
          tips_short: "请留意微信通知。",
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
        var orgEmail = organizerEmail(cfg);
        var adminParams = {
          admin_subject_hint: data.name + " · 尾号" + phoneTail,
          sheet_headers_line: headersLine,
          sheet_row_line: sheetRow,
          admin_plain: adminPlain,
          reply_to: data.email,
          /* 管理员模板若沿用报名者版式，下列字段可展示完整报名信息 */
          user_name: data.name,
          user_email: data.email,
          course_name: "唐卡报名 · 新申请",
          course_dates: data.name + " · 尾号" + phoneTail,
          course_place: adminPlain,
          tips_short: headersLine + "\n" + sheetRow,
          contact_email: orgEmail,
        };
        if (orgEmail) {
          adminParams.to_email = orgEmail;
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
              "。请检查管理员模板、收件人字段（如 {{to_email}}）及 organizerEmail 配置。";
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
