/**
 * 管理员后台配置
 *
 * 注意：管理口令已不在本文件维护。
 * 口令现在保存在 Supabase 数据库的 RLS 策略里：
 *   scripts/supabase-registrations.sql
 * 改口令的方式是直接在 Supabase SQL Editor 重新执行该脚本（修改其中的字符串字面量），
 * 改完无需重新部署前端。
 *
 * 这样做的好处：
 *   1. 浏览器源码里**没有任何敏感凭证**，F12 也看不到口令
 *   2. 改口令只动数据库一处，不会与前端 JS 出现不一致
 *   3. 管理员页面拉数据失败 = 口令错误，逻辑天然闭环
 */
window.TangkaAdminConfig = {
  /** sessionStorage 用于缓存当前会话口令的键名（值即口令明文，关闭标签页即失效） */
  sessionKey: "tangka_admin_secret",
};
