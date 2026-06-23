/**
 * EmailJS 配置 —— 请替换为您的账号信息后启用邮件发送。
 * https://www.emailjs.com/
 *
 * 请在后台创建「电子邮件服务」+ 两个「电子邮件模板」，并将模板变量与下文保持一致，
 * 管理员可将管理员模板全文粘贴至腾讯文档/表格留存。
 *
 * ─── 报名者模板 templateApplicant 建议变量 ─────────────────────────
 *   {{to_email}}      报名者邮箱（模板 To email 填 {{to_email}}）
 *   {{user_name}}     报名者姓名
 *   {{user_email}}    报名者邮箱
 *   {{course_name}}   固定文案：唐卡传承公益体验课
 *   {{course_dates}}  固定文案：2026年7月3日 — 7月9日（共七天）
 *   {{course_place}}  地点一整句（可从下文常量拷贝）
 *   {{contact_email}} 主办方咨询邮箱（putihuayuan2026@163.com）
 *   {{reply_to}}      建议与 contact_email 相同，便于学员回信咨询
 *   {{tips_short}}    简短温馨提示一句（可选）
 *
 * ─── 管理员模板 templateAdmin 建议变量 ─────────────────────────────
 *   {{to_email}}            管理员收件（与 organizerEmail 一致；模板 To 填 {{to_email}}）
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
  publicKey: "Nu1A_0bGsnr_l9-Sh",

  /**
   * Email Service ID — 163 SMTP（putihuayuan2026@163.com）
   */
  serviceId: "service_putihuayuan163",

  /** 发给报名者的模板 ID */
  templateApplicant: "template_applicant",

  /** 发给管理员的通知模板 ID */
  templateAdmin: "template_admin",

  /**
   * 主办方挂靠邮箱：EmailJS 发信服务、管理员通知收件、学员回信、页脚展示均用此地址。
   */
  organizerEmail: "putihuayuan2026@163.com",

  /** @deprecated 请改用 organizerEmail；保留以兼容旧引用 */
  adminNotifyEmail: "putihuayuan2026@163.com",

  /** 固定课程文案（模板与代码共用） */
  courseName: "唐卡传承公益体验课",
  courseDates: "2026年7月3日 — 7月9日（共七天）",
  coursePlace: "惠州博罗县埔筏村山祥湖小组42号 · 菩提画院",
};
