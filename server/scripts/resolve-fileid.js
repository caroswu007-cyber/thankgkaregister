/**
 * 从智能表浏览器地址解析 encodedID，调用官方「fileID 转换」得到 OpenAPI 用的 fileID。
 * 用法（在 server 目录下）：
 *   node scripts/resolve-fileid.js "https://docs.qq.com/sheet/Dxxxx?tab=BB08yy"
 *   node scripts/resolve-fileid.js Dxxxx
 *
 * 文档：https://docs.qq.com/open/document/app/openapi/v2/file/util/converter.html
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ACCESS = process.env.TENCENT_ACCESS_TOKEN || "";
const CLIENT = process.env.TENCENT_CLIENT_ID || "";
const OPEN = process.env.TENCENT_OPEN_ID || "";

function parseArg(raw) {
  var s = String(raw || "").trim();
  if (!s) return { encoded: "", tab: "" };
  if (s.indexOf("http") === 0) {
    try {
      var u = new URL(s);
      var m = u.pathname.match(/\/sheet\/([^/]+)/i);
      var encoded = m ? m[1] : "";
      var tab = u.searchParams.get("tab") || "";
      return { encoded: encoded, tab: tab };
    } catch (e) {
      return { encoded: "", tab: "" };
    }
  }
  return { encoded: s.replace(/^\/+|\/+$/g, ""), tab: "" };
}

async function main() {
  var arg = process.argv.slice(2).join(" ").trim();
  if (!arg) {
    console.error(
      "请传入智能表链接或 encodedID，例如：\n" +
        '  node scripts/resolve-fileid.js "https://docs.qq.com/sheet/Dxxxx?tab=BB08yy"\n' +
        "  node scripts/resolve-fileid.js Dxxxx"
    );
    process.exit(1);
  }
  if (!ACCESS || !CLIENT || !OPEN) {
    console.error("请先在 server/.env 配置 TENCENT_ACCESS_TOKEN、TENCENT_CLIENT_ID、TENCENT_OPEN_ID");
    process.exit(1);
  }

  var { encoded, tab } = parseArg(arg);
  if (!encoded) {
    console.error("未能从参数中解析出文档 encodedID（链接里 /sheet/ 后面的那一段）");
    process.exit(1);
  }

  var url =
    "https://docs.qq.com/openapi/drive/v2/util/converter?type=2&value=" +
    encodeURIComponent(encoded);
  var res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Access-Token": ACCESS,
      "Client-Id": CLIENT,
      "Open-Id": OPEN,
    },
  });
  var text = await res.text();
  var data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    console.error("接口返回非 JSON:", text.slice(0, 300));
    process.exit(1);
  }
  if (data.ret !== 0) {
    console.error("转换失败:", data.msg || text, "ret=", data.ret);
    process.exit(1);
  }
  var fileID = data.data && data.data.fileID;
  if (!fileID) {
    console.error("响应中无 data.fileID:", JSON.stringify(data));
    process.exit(1);
  }

  console.log("");
  console.log("将下面两行追加或合并到 server/.env ：");
  console.log("");
  console.log("TENCENT_FILE_ID=" + fileID);
  if (tab) {
    console.log("TENCENT_SHEET_ID=" + tab);
    console.log("");
    console.log("（sheetID 来自你链接里的 ?tab= 参数；若当前子表不是智能表，请在文档里切换到智能表子表再复制链接。）");
  } else {
    console.log("TENCENT_SHEET_ID=请从链接 ?tab= 填写，或调用「查询子表」接口");
    console.log("");
    console.log("提示：在浏览器打开该智能表，地址栏应类似 …/sheet/Dxxx?tab=BB08yy ，tab= 后面即为子表 ID。");
  }
  console.log("");
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
