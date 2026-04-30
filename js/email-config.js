/**
 * EmailJS 配置 —— 请替换为您的账号信息后启用邮件发送。
 * https://www.emailjs.com/
 *
 * 请在后台创建「电子邮件服务」+ 两个「电子邮件模板」，并将模板变量与下文保持一致，
 * 管理员可将管理员模板全文粘贴至腾讯文档/表格留存。
 *
 * ─── 报名者模板 templateApplicant 建议变量 ─────────────────────────
 *   {{user_name}}     报名者姓名
 *   {{user_email}}    报名者邮箱（收件人已设为报名者时可仅用正文称呼）
 *   {{course_name}}   固定文案：唐卡传承公益体验课
 *   {{course_dates}}  固定文案：2026年4月8日 — 4月12日（共五天）
 *   {{course_place}}  地点一整句（可从下文常量拷贝）
 *   {{tips_short}}    简短温馨提示一句（可选）
 *
 * ─── 管理员模板 templateAdmin 建议变量 ─────────────────────────────
 *   {{to_email}}            管理员收件（与 email-config.js 中 adminNotifyEmail 一致；模板 To 填 {{to_email}}）
 *   {{admin_subject_hint}}  邮件标题摘要：姓名 · 手机尾号（示例）
 *   {{sheet_headers_line}}  TSV 表头一行（与腾讯表格第一行一致，便于整表粘贴）
 *   {{sheet_row_line}}      TSV 数据一行（粘贴到腾讯表格下一行）
 *   {{admin_plain}}         全文可读摘要（纯文本多行，便于复制到文档）
 *   {{reply_to}}            报名者邮箱（回复用）
 *
 * 腾讯文档说明：在线表格无面向纯静态页的官方写入 API；标准做法是管理员收到邮件后，
 * 将 sheet_row_line 粘贴到腾讯表格，或使用 admin_plain 归档。
 */
window.TangkaEmailConfig = {
  /** EmailJS Public Key（账户 — API Keys） */
  publicKey: "HEFYCnnmAttscMfp6",

  /** Email Service ID（电子邮件服务 ID）— 在 Email Services 中创建 Gmail 并「Create Service」后复制 */
  serviceId: "YOUR_SERVICE_ID",

  /** 发给报名者的模板 ID */
  templateApplicant: "YOUR_TEMPLATE_APPLICANT",

  /** 发给管理员的通知模板 ID */
  templateAdmin: "YOUR_TEMPLATE_ADMIN",

  /**
   * 管理员通知收件邮箱（与 Account 页通知邮箱一致即可；模板 To 填 {{to_email}}）。
   */
  adminNotifyEmail: "caroswu007@gmail.com",

  /** 固定课程文案（模板与代码共用） */
  courseName: "唐卡传承公益体验课",
  courseDates: "2026年4月8日 — 4月12日（共五天）",
  coursePlace:
    "广东 · 深圳市龙岗区横岗新园路88号 · 东方字礼文化美愈康养基地",

  /**
   * 演示模式：为 true 时仍可递减本地名额；若已配置 Supabase/腾讯代理/自定义接口，
   * 会与邮件并行写入（见 register.js）。未配邮箱且未配同步时，仅控制台打印 TSV 示例。
   * 若已正确配置 EmailJS（非 YOUR_ 占位），演示模式下**仍会发送**报名者与管理员邮件。
   * 正式上线、且不需要演示时，请改为 false。
   */
  allowDemoSubmit: true,
};
