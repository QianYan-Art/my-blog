#!/usr/bin/env bash
set -euo pipefail

BLOG_DIR="/www/wwwroot/blog"
ENV_FILE="/etc/blog-sync.env"
PROXY_KEY="/root/.ssh/blog-sync-proxy.key"
PROXY_HOST="124.156.206.155"
PROXY_PORT="23333"
LOCAL_SOCKS_PORT="11080"
SYNC_LOG_PREFIX="[blog-sync]"
TEMP_DIR=""

log() {
  printf '%s %s %s\n' "$(date '+%F %T')" "$SYNC_LOG_PREFIX" "$*"
}

cleanup_proxy() {
  pkill -f "ssh -i ${PROXY_KEY}.*-D 127.0.0.1:${LOCAL_SOCKS_PORT}.*${PROXY_HOST}" >/dev/null 2>&1 || true
}

cleanup_temp() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}

read_count() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo 0
    return
  fi
  node -e "const fs=require('fs');const p=process.argv[1];const data=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(String((data.articles||[]).length));" "$file"
}

run_sync() {
  (cd "$BLOG_DIR" && timeout "${1}" node scripts/sync-kbase.js)
}

start_proxy() {
  cleanup_proxy
  ssh -i "$PROXY_KEY" \
    -o StrictHostKeyChecking=no \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ConnectTimeout=10 \
    -f -N -D "127.0.0.1:${LOCAL_SOCKS_PORT}" \
    -p "$PROXY_PORT" \
    "root@${PROXY_HOST}"
}

if [[ ! -f "$ENV_FILE" ]]; then
  log "缺少环境变量文件：$ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export KBASE_SOURCE="${KBASE_SOURCE:-github}"
export KBASE_OWNER="${KBASE_OWNER:-QianYan-Art}"
export KBASE_REPO="${KBASE_REPO:-QianYan-KBase}"
export KBASE_BRANCH="${KBASE_BRANCH:-main}"
export KBASE_PUBLIC_DIR="${KBASE_PUBLIC_DIR:-public}"
export KBASE_MIN_COUNT="${KBASE_MIN_COUNT:-1}"
export KBASE_MIN_RATIO="${KBASE_MIN_RATIO:-0.6}"

trap 'cleanup_proxy; cleanup_temp' EXIT

CURRENT_JSON="${BLOG_DIR}/assets/data/articles.json"
CURRENT_POSTS="${BLOG_DIR}/posts/kbase"
TEMP_DIR="$(mktemp -d /tmp/blog-sync.XXXXXX)"
BACKUP_JSON="${TEMP_DIR}/articles.json"
BACKUP_POSTS="${TEMP_DIR}/kbase"

if [[ -f "$CURRENT_JSON" ]]; then
  cp "$CURRENT_JSON" "$BACKUP_JSON"
fi
if [[ -d "$CURRENT_POSTS" ]]; then
  cp -R "$CURRENT_POSTS" "$BACKUP_POSTS"
fi

OLD_COUNT="$(read_count "$CURRENT_JSON")"
log "开始优先通过 124 服务器代理同步 GitHub 私库文章，当前文章数：${OLD_COUNT}"
if [[ -f "$PROXY_KEY" ]]; then
  start_proxy
  sleep 2

  export ALL_PROXY="socks5h://127.0.0.1:${LOCAL_SOCKS_PORT}"
  export HTTPS_PROXY="$ALL_PROXY"
  export HTTP_PROXY="$ALL_PROXY"

  if run_sync 300s 2>/dev/null; then
    log "代理同步成功"
  else
    log "代理同步失败，回退到服务器直连重试"
    unset ALL_PROXY HTTPS_PROXY HTTP_PROXY
    cleanup_proxy
    run_sync 240s
    log "直连重试成功"
  fi
else
  log "缺少代理 key：$PROXY_KEY，改为服务器直连同步"
  unset ALL_PROXY HTTPS_PROXY HTTP_PROXY
  run_sync 240s
  log "直连同步成功"
fi

NEW_COUNT="$(read_count "$CURRENT_JSON")"
MIN_ALLOWED="$KBASE_MIN_COUNT"
if [[ "$OLD_COUNT" -gt 0 ]]; then
  RATIO_MIN="$(node -e "const oldCount=Number(process.argv[1]);const ratio=Number(process.argv[2]);process.stdout.write(String(Math.max(1, Math.ceil(oldCount * ratio))));" "$OLD_COUNT" "$KBASE_MIN_RATIO")"
  if [[ "$RATIO_MIN" -gt "$MIN_ALLOWED" ]]; then
    MIN_ALLOWED="$RATIO_MIN"
  fi
fi

if [[ "$NEW_COUNT" -lt "$MIN_ALLOWED" ]]; then
  log "同步结果异常：新文章数 ${NEW_COUNT} 低于安全阈值 ${MIN_ALLOWED}，开始回滚"
  if [[ -f "$BACKUP_JSON" ]]; then
    cp "$BACKUP_JSON" "$CURRENT_JSON"
  fi
  if [[ -d "$BACKUP_POSTS" ]]; then
    rm -rf "$CURRENT_POSTS"
    cp -R "$BACKUP_POSTS" "$CURRENT_POSTS"
  fi
  exit 1
fi

log "同步完成：${OLD_COUNT} -> ${NEW_COUNT}"
