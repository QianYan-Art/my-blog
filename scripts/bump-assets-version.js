// 一键更新静态资源缓存版本号（cache-busting）
//
// 作用：把所有 HTML 与文章模板里 /assets/css|js 引用的 ?v= 版本号统一更新；
//      没有版本号的引用会自动补上。改完 CSS/JS 后跑一次即可让访客立即拿到新资源。
//
// 用法：
//   node scripts/bump-assets-version.js            # 用今天日期 YYYYMMDD
//   node scripts/bump-assets-version.js 20260604   # 指定版本串
//   node scripts/bump-assets-version.js 20260603b  # 同一天再次发布时加后缀
//
// 注意：文章详情页(posts/kbase/*.html)由同步脚本重新生成，其版本号来自
//      scripts/sync-kbase.js 的模板——本脚本也会更新该模板，确保再同步后仍带新版本。

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function todayVersion() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

const V = process.argv[2] || todayVersion();
if (!/^[A-Za-z0-9._-]+$/.test(V)) {
  console.error(`非法版本串：${V}（只允许字母/数字/.-_）`);
  process.exit(1);
}

// 1) 已有 ?v= 的引用 -> 换成新版本   2) 没有 ?v= 的裸引用 -> 补上
const reHasVer = /(\/assets\/[A-Za-z0-9._/-]+\.(?:css|js))\?v=[^"'#\s]*/g;
const reBare = /(\/assets\/[A-Za-z0-9._/-]+\.(?:css|js))(["'])/g;

function collectFiles(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".tmp", ".serena"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectFiles(p, out);
    else if (/\.html$/i.test(e.name)) out.push(p);
  }
  return out;
}

const targets = collectFiles(ROOT, []);
targets.push(path.join(ROOT, "scripts", "sync-kbase.js")); // 文章模板

let changed = 0;
let refs = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  let next = src.replace(reHasVer, (m, base) => { refs++; return `${base}?v=${V}`; });
  next = next.replace(reBare, (m, base, q) => { refs++; return `${base}?v=${V}${q}`; });
  if (next !== src) {
    fs.writeFileSync(file, next, "utf8");
    changed++;
  }
}

console.log(`资源版本号已更新为 ?v=${V}`);
console.log(`改动文件 ${changed} 个，更新引用 ${refs} 处。`);
console.log("提示：本地传部署时记得把改动的 HTML/CSS/JS 传到服务器；文章页版本号会在下次同步时随模板生效。");
