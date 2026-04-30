require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fileID = process.argv[2] || process.env.TENCENT_FILE_ID;
if (!fileID) {
  console.error("用法: node scripts/list-sheets-once.js <fileID>");
  console.error("或未传参时在 .env 中配置 TENCENT_FILE_ID 后: npm run list-sheets");
  process.exit(1);
}
const url =
  "https://docs.qq.com/openapi/smartbook/v2/files/" +
  encodeURIComponent(fileID) +
  "/sheets";
fetch(url, {
  headers: {
    Accept: "application/json",
    "Access-Token": process.env.TENCENT_ACCESS_TOKEN || "",
    "Client-Id": process.env.TENCENT_CLIENT_ID || "",
    "Open-Id": process.env.TENCENT_OPEN_ID || "",
  },
})
  .then((r) => r.text())
  .then((t) => {
    var data;
    try {
      data = JSON.parse(t);
    } catch (_) {
      console.log(t);
      return;
    }
    if (data.ret !== 0) {
      console.log(JSON.stringify(data, null, 2));
      if (data.ret === 10007) {
        console.error(
          "\n提示：需在开放平台应用里勾选智能表相关 scope（如 smartsheet / smartsheet.readonly），并重新走授权换新的 access_token。"
        );
      }
      process.exit(1);
      return;
    }
    var list = (data.data && data.data.getSheet) || [];
    console.log(JSON.stringify(list, null, 2));
    list.forEach(function (s) {
      console.log("sheetID=" + s.sheetID + "  title=" + (s.title || ""));
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
