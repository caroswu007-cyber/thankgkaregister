/**
 * 唐卡报名系统 — 名额与报名开关（与 admin.html 共用 localStorage）
 */
(function () {
  var STORAGE_OPEN = "tangka_reg_open";
  var STORAGE_REMAINING = "tangka_reg_remaining";
  var DEFAULT_TOTAL = 108;

  /** file:// 打开页面时浏览器可能禁用 localStorage，需包裹避免整页脚本报错 */
  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readRemaining() {
    var raw = storageGet(STORAGE_REMAINING);
    if (raw === null || raw === "") return DEFAULT_TOTAL;
    var n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TOTAL;
  }

  function isRegistrationOpen() {
    var v = storageGet(STORAGE_OPEN);
    if (v === null || v === "") return true;
    return v === "1" || v === "true";
  }

  function decrementRemaining(amount) {
    var n = typeof amount === "number" && amount > 0 ? Math.floor(amount) : 1;
    var next = Math.max(0, readRemaining() - n);
    storageSet(STORAGE_REMAINING, String(next));
    return next;
  }

  function canRegister() {
    return isRegistrationOpen() && readRemaining() > 0;
  }

  window.TangkaSite = {
    STORAGE_OPEN: STORAGE_OPEN,
    STORAGE_REMAINING: STORAGE_REMAINING,
    DEFAULT_TOTAL: DEFAULT_TOTAL,
    readRemaining: readRemaining,
    isRegistrationOpen: isRegistrationOpen,
    storageSet: storageSet,
    decrementRemaining: decrementRemaining,
    canRegister: canRegister,

    /** 更新首页报名按钮与名额展示（链接或 button） */
    bindIndexPage: function () {
      var btn = document.getElementById("btn-register");
      var spotsEl = document.getElementById("spots-remaining");
      if (!btn && !spotsEl) return;

      var open = isRegistrationOpen();
      var remaining = readRemaining();

      if (spotsEl) {
        spotsEl.textContent = String(remaining);
      }

      if (btn) {
        var hrefRegister = "register.html";
        if (!open || remaining <= 0) {
          if (btn.tagName === "A") {
            btn.setAttribute("href", "#");
            btn.classList.add("is-disabled");
          } else {
            btn.disabled = true;
          }
          btn.textContent = remaining <= 0 ? "名额已满" : "报名已截止";
          btn.setAttribute("aria-disabled", "true");
        } else {
          if (btn.tagName === "A") {
            btn.setAttribute("href", hrefRegister);
            btn.classList.remove("is-disabled");
          } else {
            btn.disabled = false;
          }
          btn.textContent = "立即报名";
          btn.removeAttribute("aria-disabled");
        }
      }
    },
  };
})();
