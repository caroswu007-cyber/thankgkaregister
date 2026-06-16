/**
 * 与「腾讯文档」协同 —— 不提供 HTTP 写入接口时的数据格式约定。
 * 管理员在腾讯表格新建第一行为 SHEET_HEADERS，报名邮件中的 sheet_row_line 整行粘贴即可。
 */
(function (global) {
  /** 与邮件 / 导出 CSV 对齐的列顺序（勿轻易改列名，便于一期一期沿用） */
  var SHEET_HEADERS = [
    "姓名",
    "证件类型",
    "证件号码",
    "手机号",
    "微信号",
    "年龄",
    "电子邮箱",
    "性别",
    "所在城市",
    "联系地址",
    "需要住宿",
    "紧急联系人",
    "紧急联系人电话",
    "与申请人关系",
    "绘画基础",
    "家属同意",
    "身体健康声明",
    "知晓活动规则",
    "证件SHA256",
    "提交时间",
  ];

  /**
   * @param {object} data — register.js 组装后的字段
   * @returns {string} TSV 一行（Tab 分隔）
   */
  function buildPasteRow(data) {
    var yn = function (v) {
      return v ? "是" : "否";
    };
    var cells = [
      data.name || "",
      data.idType || "",
      data.idCard || "",
      data.phone || "",
      data.wechat || "",
      data.age != null ? String(data.age) : "",
      data.email || "",
      data.gender || "",
      data.city || "",
      data.contactAddress || "",
      data.needsLodging ? "是" : "否",
      data.emergencyName || "",
      data.emergencyPhone || "",
      data.emergencyRelation || "",
      data.artBase || "",
      yn(data.healthFamily),
      yn(data.healthBody),
      yn(data.healthRules),
      data.idSha256 || "",
      data.submittedAt || "",
    ];
    return cells
      .map(function (c) {
        var s = String(c).replace(/\r|\n|\t/g, " ");
        return s;
      })
      .join("\t");
  }

  function buildHeadersLine() {
    return SHEET_HEADERS.join("\t");
  }

  /**
   * 解析腾讯表格 / 邮件中的一行 TSV（与 SHEET_HEADERS 列序一致）
   * @returns {{ ok:true, fields:object } | { ok:false, error:string }}
   */
  function parseSheetRow(line) {
    var raw = String(line || "").trim();
    if (!raw) return { ok: false, error: "内容为空" };
    var parts = raw.split("\t");
    if (parts.length < SHEET_HEADERS.length) {
      return {
        ok: false,
        error:
          "列数为 " +
          parts.length +
          "，至少需要 " +
          SHEET_HEADERS.length +
          " 列（与表头一致）。",
      };
    }
    return {
      ok: true,
      fields: {
        name: parts[0],
        idCard: parts[1],
        phone: parts[2],
        wechat: parts[3],
        age: parts[4],
        email: parts[5],
        gender: parts[6],
        city: parts[7],
        artBase: parts[8],
        healthFamily: parts[9],
        healthBody: parts[10],
        healthRules: parts[11],
        idSha256: parts[12],
        submittedAt: parts[13],
      },
    };
  }

  global.TangkaTencentDocs = {
    SHEET_HEADERS: SHEET_HEADERS,
    buildPasteRow: buildPasteRow,
    buildHeadersLine: buildHeadersLine,
    parseSheetRow: parseSheetRow,
  };
})(typeof window !== "undefined" ? window : this);
