#!/usr/bin/env bash
# 通用发布脚本：构建 → 推 gh-pages → 输出地址
# 用法: ./publish-any.sh <用户名> <仓库名> [静态目录]
set -euo pipefail
OWNER="${1:?用法: publish-any.sh <用户名> <仓库名>}"
REPO="${2:?用法: publish-any.sh <用户名> <仓库名>}"
STATIC_DIR="${3:-deploy-static}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONF="${GH_CONFIG_DIR:-$HOME/Documents/depseek/.gh-config}"
if [ ! -f "$CONF/hosts.yml" ]; then
  echo "❌ 未找到 GitHub 认证（$CONF/hosts.yml）"
  exit 1
fi
TOKEN=$(sed -n 's/.*oauth_token: *//p' "$CONF/hosts.yml" | head -1)
[ -z "$TOKEN" ] && { echo "❌ token 为空"; exit 1; }

echo "▸ 构建"
if [ -f package.json ]; then
  npx tsc --noEmit 2>/dev/null || true
  npm run build
fi

echo "▸ 整理静态目录"
rm -rf "$STATIC_DIR" && mkdir -p "$STATIC_DIR"
cp -R dist/. "$STATIC_DIR/" 2>/dev/null || true
touch "$STATIC_DIR/.nojekyll"

echo "▸ 推送 gh-pages"
rm -rf /tmp/ghp-any && mkdir -p /tmp/ghp-any
cp -R "$STATIC_DIR/." /tmp/ghp-any/
cd /tmp/ghp-any
git init -q
git config user.name "${GIT_AUTHOR_NAME:-deploy}"
git config user.email "${GIT_AUTHOR_EMAIL:-deploy@localhost}"
git add -A
git commit -q -m "发布 $(date '+%Y-%m-%d %H:%M')"
git remote add origin "https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO}.git"
git push -f origin HEAD:gh-pages

echo ""
echo "✅ https://${OWNER}.github.io/${REPO}/"
