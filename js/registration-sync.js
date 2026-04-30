/**
 * 将报名数据写入 Supabase 或自定义 CORS 接口，减轻腾讯表格手工维护。
 */
(function (global) {
  function cfg() {
    return global.TangkaSyncConfig || {};
  }

  function isEnabled() {
    var c = cfg();
    if (c.tencentProxyUrl && String(c.tencentProxyUrl).indexOf("http") === 0) return true;
    if (c.customPostUrl && String(c.customPostUrl).indexOf("http") === 0) return true;
    if (
      c.supabaseUrl &&
      String(c.supabaseUrl).indexOf("http") === 0 &&
      c.supabaseAnonKey &&
      c.supabaseTable
    ) {
      return true;
    }
    return false;
  }

  function idLast6FromCard(idCard) {
    var s = String(idCard || "").replace(/\s/g, "");
    return s.length >= 6 ? s.slice(-6) : s;
  }

  function buildPayload(data, idHash) {
    return {
      name: data.name,
      phone: data.phone,
      wechat: data.wechat,
      email: data.email,
      age: data.age,
      gender: data.gender,
      city: data.city,
      art_base: data.artBase,
      health_family: data.healthFamily,
      health_body: data.healthBody,
      health_rules: data.healthRules,
      id_card: data.idCard,
      id_last6: idLast6FromCard(data.idCard),
      id_hash: idHash,
      submitted_at: new Date().toISOString(),
    };
  }

  function submitSupabase(row) {
    var c = cfg();
    var url = c.supabaseUrl.replace(/\/$/, "");
    if (url.indexOf("/rest/v1/") === -1) {
      url = url.replace(/\/rest\/v1$/, "") + "/rest/v1/" + c.supabaseTable;
    }
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: c.supabaseAnonKey,
        Authorization: "Bearer " + c.supabaseAnonKey,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    }).then(function (r) {
      if (r.ok) return {};
      return r.text().then(function (t) {
        throw new Error(t || "Supabase HTTP " + r.status);
      });
    });
  }

  function submitTencentProxy(row) {
    var c = cfg();
    var url = String(c.tencentProxyUrl || "").replace(/\/$/, "");
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": c.tencentProxySecret || "",
      },
      body: JSON.stringify(row),
    }).then(function (r) {
      if (r.ok) return r.json().catch(function () { return {}; });
      return r.text().then(function (t) {
        throw new Error(t || "腾讯代理 HTTP " + r.status);
      });
    });
  }

  function submitCustom(row) {
    var c = cfg();
    var body = Object.assign({}, row);
    if (c.customToken) body._token = c.customToken;
    return fetch(c.customPostUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (r.ok) return r.json().catch(function () { return {}; });
      return r.text().then(function (t) {
        throw new Error(t || "同步接口 HTTP " + r.status);
      });
    });
  }

  /**
   * @param {object} data collectAndValidate 结果
   * @param {string} idHash 身份证 SHA-256 十六进制
   */
  function submitRegistration(data, idHash) {
    if (!isEnabled()) return Promise.resolve({ skipped: true });
    var row = buildPayload(data, idHash);
    var c = cfg();
    if (c.tencentProxyUrl && String(c.tencentProxyUrl).indexOf("http") === 0) {
      return submitTencentProxy(row);
    }
    if (c.customPostUrl && String(c.customPostUrl).indexOf("http") === 0) {
      return submitCustom(row);
    }
    return submitSupabase(row);
  }

  global.TangkaRegistrationSync = {
    isEnabled: isEnabled,
    submitRegistration: submitRegistration,
    buildPayload: buildPayload,
  };
})(typeof window !== "undefined" ? window : this);
