/**
 * 管理员后台 —— 仅前端口令，用于防止误闯；正式环境请改为强密码并限制知悉范围。
 */
window.TangkaAdminConfig = {
  /** 登录口令（明文比对，勿提交到公开仓库时可改为环境内约定） */
  password: "tangka_admin",

  /** sessionStorage 键名 */
  sessionKey: "tangka_admin_ok",
};
