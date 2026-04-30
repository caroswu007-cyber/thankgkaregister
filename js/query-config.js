/**
 * 学员查询数据源
 *
 * - 默认：拉取 data/students.json（管理员手工维护）
 * - 腾讯文档：填写 tencentQueryUrl，或留空但已在 sync-config.js 配置 tencentProxyUrl（…/append）时自动改为 …/query
 */
window.TangkaQueryConfig = {
  /** 例：https://你的域名/query */
  tencentQueryUrl: "",

  /**
   * 与 server/.env 的 WEBHOOK_SECRET 一致；未设置密钥时可留空。
   * 若留空且已配置 TangkaSyncConfig.tencentProxySecret，查询请求会复用该值。
   */
  tencentQuerySecret: "",
};
