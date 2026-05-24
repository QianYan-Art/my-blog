const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const IGNORE_DIRS = new Set([".git", "node_modules", ".tmp"]);

function walkJsFiles(dir) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkJsFiles(fullPath));
      continue;
    }
    if (/\.js$/i.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

function main() {
  const files = walkJsFiles(ROOT);
  for (const filePath of files) {
    const res = spawnSync(process.execPath, ["--check", filePath], {
      stdio: "inherit"
    });
    if (res.status !== 0) {
      process.exit(res.status || 1);
    }
  }
  console.log(`语法检查通过，共 ${files.length} 个 JS 文件。`);
}

main();
