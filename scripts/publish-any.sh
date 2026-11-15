#!/usr/bin/env bash
# 通用发布脚本：构建 → 推 gh-pages → 输出地址
# 用法: ./publish-any.sh <用户名> <仓库名>
set -euo pipefail
OWNER="${1:?用法: publish-any.sh <用户名> <仓库名>}"
REPO="${2:?用法: publish-any.sh <用户名> <仓库名>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONF="${GH_CONFIG_DIR:-/Users/leo/Documents/depseek/.gh-config}"
if [ ! -f "$CONF/hosts.yml" ]; then
  echo "❌ 未找到 GitHub 认证（$CONF/hosts.yml）"
  echo "   先执行："
  echo "   export GH_CONFIG_DIR=$CONF HTTPS_PROXY=http://127.0.0.1:7897 BROWSER=echo"
  echo "   gh auth login --hostname github.com --git-protocol https --web < /dev/null"
  exit 1
fi
TOKEN=$(sed -n 's/.*oauth_token: *//p' "$CONF/hosts.yml" | head -1)
[ -z "$TOKEN" ] && { echo "❌ token 为空"; exit 1; }

echo "▸ 构建"
npx tsc --noEmit
npm run build

echo "▸ 整理静态目录"
rm -rf deploy-static && mkdir -p deploy-static
cp -R dist/. deploy-static/
touch deploy-static/.nojekyll

echo "▸ 推送 gh-pages"
rm -rf /tmp/ghp && mkdir -p /tmp/ghp && cd /tmp/ghp
git init -q && git config user.name leo && git config user.email leo@local
cp -R "$ROOT/deploy-static/." .
touch .nojekyll
git add -A && git commit -q -m "发布 $(date '+%Y-%m-%d %H:%M')"
git remote add origin "https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO}.git"
git push -f origin HEAD:gh-pages

echo ""
echo "✅ https://${OWNER}.github.io/${REPO}/"
