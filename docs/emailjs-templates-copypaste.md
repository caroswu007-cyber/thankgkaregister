# EmailJS 模板与服务配置（复制粘贴用）

在 [EmailJS Dashboard](https://dashboard.emailjs.com/admin) 按下列内容配置。  
主办方邮箱统一：**putihuayuan2026@163.com**

---

## 1. 邮件服务（163 SMTP）

**Email Services → Add New Service → SMTP**

| 字段 | 值 |
|------|-----|
| Name | 菩提画院 163 |
| Service ID | `service_putihuayuan163`（或任意，记下后填入 `js/email-config.js`） |
| Host | `smtp.163.com` |
| Port | `465` |
| User | `putihuayuan2026@163.com` |
| App Password | 163 邮箱「客户端授权码」（不是登录密码） |
| SSL | 开启 |

163 授权码获取：登录 [mail.163.com](https://mail.163.com) → 设置 → POP3/SMTP/IMAP → 开启服务 → 新增授权码。

配置完成后将 **Service ID** 更新到 `js/email-config.js` 的 `serviceId`，并设为 Default Service。

---

## 2. 报名者模板 `template_qjl4zmw`

**Subject（主题）**

```
{{course_name}} · 报名已收到
```

**To email**

```
{{to_email}}
```

**Reply To**

```
{{reply_to}}
```

**Content（正文，可用纯文本或 HTML）**

```
尊敬的 {{user_name}}：

您已成功提交「{{course_name}}」报名申请，我们已收到您的信息。

课程时间：{{course_dates}}
课程地点：{{course_place}}

{{tips_short}}

如有疑问，请回信至：{{contact_email}}

菩提画院 · 唐卡传承公益体验课
```

---

## 3. 管理员模板 `template_jni7nor`

**Subject（主题）**

```
【唐卡报名】{{admin_subject_hint}}
```

**To email**

```
{{to_email}}
```

**Reply To**

```
{{reply_to}}
```

**Content（正文）**

```
{{admin_plain}}

————————————————
腾讯表格粘贴（表头 + 数据行）：
{{sheet_headers_line}}
{{sheet_row_line}}
```

---

## 4. 安全设置

**Account → Security**

- 若仅通过网站浏览器发信：保持「Block non-browser API calls」开启即可（当前正常）。
- 若需服务器脚本测试发信：临时关闭该选项，或配置 Private Key。

---

## 5. 验证

部署后打开 `https://putihuayuan.org/register.html` 提交测试报名，或本地打开 `scripts/emailjs-browser-test.html` 发送测试邮件。
