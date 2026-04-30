# EmailJS 自动发信配置（报名确认 + 管理员通知）

站点在提交成功后通过 [EmailJS](https://www.emailjs.com/) 从浏览器各发一封邮件：**报名者确认**、**管理员台账提醒**（含可粘贴腾讯表的 TSV 行）。无需自建 SMTP 服务器。

## 1. 注册并创建服务

1. 打开 [EmailJS](https://www.emailjs.com/)，注册账号。  
2. **Email Services** → Add New Service → 选择你的发信邮箱类型（Gmail、Outlook 等），按向导完成授权。  
3. 记下 **Service ID**（形如 `service_xxx`）。

## 2. 创建两个邮件模板

**Account → Email Templates** 新建两个模板，分别对应 `js/email-config.js` 里的 `templateApplicant` 与 `templateAdmin`（记下各自的 **Template ID**，形如 `template_xxx`）。

### 2.1 报名者模板（建议主题）

例如：`{{course_name}} · 报名已收到`

正文可包含变量（与代码发送的字段名一致）：

| 变量 | 含义 |
|------|------|
| `{{to_email}}` | 报名者邮箱（在模板 **To email** 中填 `{{to_email}}`，收件人为本人） |
| `{{user_name}}` | 姓名 |
| `{{user_email}}` | 邮箱 |
| `{{course_name}}` | 课程名称 |
| `{{course_dates}}` | 日期文案 |
| `{{course_place}}` | 地点 |
| `{{tips_short}}` | 一句温馨提示 |

### 2.2 管理员模板

**To email** 建议填 `{{to_email}}`，并在 `js/email-config.js` 中配置 **`adminNotifyEmail`** 为你的工作邮箱（与模板变量一致）。若 EmailJS 固定写死管理员地址，也可在模板里写死 To，此时可不填 `adminNotifyEmail`（代码仍会传 `reply_to` 等变量）。

| 变量 | 含义 |
|------|------|
| `{{to_email}}` | 可选；配置了 `adminNotifyEmail` 时由代码传入 |
| `{{admin_subject_hint}}` | 标题摘要：姓名 · 手机尾号 |
| `{{sheet_headers_line}}` | TSV 表头一行 |
| `{{sheet_row_line}}` | TSV 数据一行（粘贴到腾讯智能表） |
| `{{admin_plain}}` | 纯文本多行摘要 |
| `{{reply_to}}` | 报名者邮箱，便于直接回复 |

## 3. 填写 `js/email-config.js`

1. **Account → API Keys** 复制 **Public Key**，填入 `publicKey`。  
2. 将 `serviceId`、`templateApplicant`、`templateAdmin` 替换为实际 ID。  
3. 将 `adminNotifyEmail` 设为管理员收件邮箱（与管理员模板 To 策略一致）。  
4. 确认四个字段都不再包含占位符 `YOUR_` 后，即视为「已配置」。  
5. **`allowDemoSubmit`**：  
   - 联调时可保持 **`true`**：仍会跳过 Supabase/腾讯代理，但若 EmailJS 已配好，**仍会真实发两封邮件**。  
   - 正式上线若不再需要「无邮件试提交」，可改为 **`false`**，并确保 EmailJS 或同步渠道至少一种可用。

## 4. 常见问题

- **收不到邮件**：检查垃圾邮件；Gmail 需在 EmailJS 中重新授权；免费额度是否用尽。  
- **管理员邮件失败、报名者已成功**：查看页面顶部报错；核对管理员模板 **To** 是否使用 `{{to_email}}` 且已配置 `adminNotifyEmail`。  
- **403 / 变量未识别**：模板中的变量名须与上表**完全一致**（区分大小写）。  
- **CSP / 脚本被拦**：`register.html` 从 jsDelivr 加载 EmailJS；若你自行加了严格 CSP，需放行该域名。

## 5. 隐私说明

确认邮件发往报名者本人填写的邮箱；身份证号仅以 **SHA-256** 摘要出现在管理员邮件的 TSV/正文中，**不发送完整证件号**（与 `register.js` 中 `buildPasteRow` 行为一致；管理员邮件里的 `admin_plain` 若包含证件字段请自行在模板中删减）。
