const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = ["index.html", "blog/index.html", "about/index.html", "projects/index.html", "404.html", "scripts/sync-kbase.js"];
const required = [
  "https://beian.miit.gov.cn/#/Integrated/recordQuery",
  "黑ICP备2025044264号-1",
  "https://beian.mps.gov.cn/#/query/webSearch?code=23010802000130",
  "黑公网安备23010802000130号",
  'src="/assets/img/police-filing.png"',
  'class="status-legal"',
  'class="status-meta"'
];

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const start = source.indexOf('<footer class="site-footer">');
  const end = source.indexOf("</footer>", start);
  assert(start >= 0 && end > start, `${file} 缺少页脚`);
  const footer = source.slice(start, end);
  for (const item of required) {
    assert.strictEqual(footer.split(item).length - 1, 1, `${file} 页脚缺失或重复：${item}`);
  }
  assert.strictEqual(footer.split('rel="noopener noreferrer"').length - 1, 2, `${file} 备案外链缺少安全属性`);
}
const image = fs.readFileSync(path.join(root, "assets/img/police-filing.png"));
assert(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "备案图标不是有效PNG");
console.log("六处页脚备案链接、编号、分组及本地图标检查通过。");
