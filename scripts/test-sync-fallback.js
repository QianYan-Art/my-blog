const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "ops/blog-sync-kbase.sh"), "utf8");

function findBash() {
  if (process.platform !== "win32") return "bash";
  const git = spawnSync("where.exe", ["git"], { encoding: "utf8" });
  const candidates = [
    path.join(process.env.USERPROFILE || "", "scoop/apps/git/current/bin/bash.exe"),
    path.join(process.env.ProgramFiles || "C:/Program Files", "Git/bin/bash.exe"),
    ...String(git.stdout || "").trim().split(/\r?\n/).filter(Boolean)
      .map(file => path.resolve(path.dirname(file), "../bin/bash.exe"))
  ];
  const bash = candidates.find(file => fs.existsSync(file));
  assert(bash, "回归测试需要 Git for Windows 的 Bash，不能使用 WSL 启动器代替");
  return bash;
}

function bashPath(file) {
  const normalized = file.replace(/\\/g, "/");
  return normalized.replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
}

function quote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, `测试隔离锚点必须唯一：${before}`);
  return text.replace(before, after);
}

const bash = findBash();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "blog-sync-fallback-"));
const cases = [
  { name: "代理成功", ssh: 0, proxy: 0, direct: 0, routes: ["proxy"], exit: 0 },
  { name: "隧道失败后直连成功", ssh: 255, proxy: 0, direct: 0, routes: ["direct"], exit: 0 },
  { name: "隧道和直连均失败", ssh: 255, proxy: 0, direct: 17, routes: ["direct"], exit: 17 },
  { name: "代理同步失败后直连成功", ssh: 0, proxy: 23, direct: 0, routes: ["proxy", "direct"], exit: 0 },
  { name: "代理超时后直连成功", ssh: 0, proxy: 124, direct: 0, routes: ["proxy", "direct"], exit: 0 },
  { name: "代理和直连均失败", ssh: 0, proxy: 23, direct: 17, routes: ["proxy", "direct"], exit: 17 },
  { name: "缺少密钥走直连", noKey: true, ssh: 0, proxy: 0, direct: 0, routes: ["direct"], exit: 0 },
  { name: "缺少密钥且直连失败", noKey: true, ssh: 0, proxy: 0, direct: 17, routes: ["direct"], exit: 17 },
  { name: "隧道失败且同步数量异常回滚", ssh: 255, proxy: 0, direct: 0, shrink: true, routes: ["direct"], exit: 1 }
];

try {
  for (const [index, test] of cases.entries()) {
    const dir = path.join(scratch, String(index));
    const blog = path.join(dir, "blog");
    const envFile = path.join(dir, "sync.env");
    const key = path.join(dir, "proxy.key");
    const temp = path.join(dir, "temporary");
    const events = path.join(dir, "events");
    fs.mkdirSync(path.join(blog, "assets/data"), { recursive: true });
    fs.mkdirSync(path.join(blog, "posts/kbase"), { recursive: true });
    fs.mkdirSync(temp);
    const originalIndex = JSON.stringify({ articles: [{ id: "original" }] });
    fs.writeFileSync(path.join(blog, "assets/data/articles.json"), originalIndex);
    fs.writeFileSync(path.join(blog, "posts/kbase/original.html"), "原有文章");
    fs.writeFileSync(envFile, "KBASE_MIN_COUNT=1\nKBASE_MIN_RATIO=0.6\n");
    if (!test.noKey) fs.writeFileSync(key, "测试占位，不是私钥");

    // 只替换固定文件位置；分支、错误处理和回滚均执行真实脚本。
    let isolated = replaceOnce(source, 'BLOG_DIR="/www/wwwroot/blog"', `BLOG_DIR=${quote(bashPath(blog))}`);
    isolated = replaceOnce(isolated, 'ENV_FILE="/etc/blog-sync.env"', `ENV_FILE=${quote(bashPath(envFile))}`);
    isolated = replaceOnce(isolated, 'PROXY_KEY="/etc/blog-sync/proxy.key"', `PROXY_KEY=${quote(bashPath(key))}`);
    isolated = replaceOnce(isolated, "mktemp -d /tmp/blog-sync.XXXXXX", `mktemp -d ${quote(`${bashPath(temp)}/blog-sync.XXXXXX`)}`);
    const script = path.join(dir, "sync.sh");
    fs.writeFileSync(script, isolated.replace(/\r\n/g, "\n"));
    const wrapper = path.join(dir, "run.sh");
    fs.writeFileSync(wrapper, `#!/usr/bin/env bash
set -euo pipefail
node() { "$TEST_NODE" "$@"; }
ssh() { printf 'ssh\\n' >> "$TEST_EVENTS"; return "$TEST_SSH_STATUS"; }
pkill() { printf 'cleanup\\n' >> "$TEST_EVENTS"; }
sleep() { printf 'sleep\\n' >> "$TEST_EVENTS"; }
timeout() {
  local route=direct
  local status="$TEST_DIRECT_STATUS"
  if [[ "\${ALL_PROXY:-}" == socks5h://127.0.0.1:* ]]; then
    route=proxy
    status="$TEST_PROXY_STATUS"
    [[ "$HTTPS_PROXY" == "$ALL_PROXY" && "$HTTP_PROXY" == "$ALL_PROXY" ]] || return 98
  else
    [[ -z "\${ALL_PROXY+x}" && -z "\${HTTPS_PROXY+x}" && -z "\${HTTP_PROXY+x}" ]] || return 99
  fi
  printf '%s\\n' "$route" >> "$TEST_EVENTS"
  if [[ "$status" == 0 && "$TEST_SHRINK" == 1 ]]; then
    printf '{"articles":[]}' > assets/data/articles.json
    rm posts/kbase/original.html
  fi
  return "$status"
}
source ${quote(bashPath(script))}
`);
    const result = spawnSync(bash, ["--noprofile", "--norc", bashPath(wrapper)], {
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        TEST_NODE: bashPath(process.execPath),
        TEST_EVENTS: bashPath(events),
        TEST_SSH_STATUS: String(test.ssh),
        TEST_PROXY_STATUS: String(test.proxy),
        TEST_DIRECT_STATUS: String(test.direct),
        TEST_SHRINK: test.shrink ? "1" : "0",
        ALL_PROXY: "http://invalid.example",
        HTTPS_PROXY: "http://invalid.example",
        HTTP_PROXY: "http://invalid.example"
      }
    });
    assert.ifError(result.error);
    assert.equal(result.status, test.exit, `${test.name}\n${result.stdout}\n${result.stderr}`);
    const calls = fs.readFileSync(events, "utf8").trim().split("\n");
    assert.deepEqual(calls.filter(call => ["proxy", "direct"].includes(call)), test.routes, test.name);
    assert.equal(calls.includes("ssh"), !test.noKey, test.name);
    assert.equal(calls.includes("sleep"), !test.noKey && test.ssh === 0, test.name);
    const directIndex = calls.indexOf("direct");
    if (directIndex >= 0) assert.equal(calls[directIndex - 1], "cleanup", test.name);
    assert.equal(calls.at(-1), "cleanup", test.name);
    assert.equal(result.stdout.includes("同步完成："), test.exit === 0, test.name);
    if (test.ssh !== 0) assert(result.stdout.includes("代理隧道建立失败退出码：255"), test.name);
    assert.equal(fs.readFileSync(path.join(blog, "assets/data/articles.json"), "utf8"), originalIndex, test.name);
    assert.equal(fs.readFileSync(path.join(blog, "posts/kbase/original.html"), "utf8"), "原有文章", test.name);
    assert.deepEqual(fs.readdirSync(temp), [], test.name);
    console.log(`${test.name}：通过`);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
