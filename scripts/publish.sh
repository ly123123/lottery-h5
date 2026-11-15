#!/usr/bin/env bash
# 重新构建并发布到 GitHub Pages（gh-pages 分支）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="${GH_REPO:-ly123123/lottery-h5}"
CONF="${GH_CONFIG_DIR:-$HOME/Documents/depseek/.gh-config}"

if [ ! -f "$CONF/hosts.yml" ]; then
  echo "❌ 未找到 GitHub 认证（$CONF/hosts.yml）"
  echo "   先执行："
  echo "   export GH_CONFIG_DIR=$CONF HTTPS_PROXY=http://127.0.0.1:7897 BROWSER=echo"
  echo "   gh auth login --hostname github.com --git-protocol https --web < /dev/null"
  exit 1
fi
TOKEN=$(sed -n 's/.*oauth_token: *//p' "$CONF/hosts.yml" | head -1)
[ -z "$TOKEN" ] && { echo "❌ token 为空"; exit 1; }

echo "▸ 类型检查与构建"
npx tsc --noEmit
npm run build

echo "▸ 同步静态目录"
rm -rf deploy-static && mkdir -p deploy-static
cp -R dist/. deploy-static/
touch deploy-static/.nojekyll

echo "▸ 推送 gh-pages"
rm -rf /tmp/ghp-publish && mkdir -p /tmp/ghp-publish
cp -R deploy-static/. /tmp/ghp-publish/
cd /tmp/ghp-publish
git init -q
git config user.name "${GIT_AUTHOR_NAME:-deploy}"
git config user.email "${GIT_AUTHOR_EMAIL:-deploy@localhost}"
git add -A
git commit -q -m "发布 $(date '+%Y-%m-%d %H:%M')"
git remote add origin "https://x-access-token:${TOKEN}@github.com/${REPO}.git"
git push -f origin HEAD:gh-pages

echo ""
echo "✅ 已发布：https://${REPO%%/*}.github.io/${REPO##*/}/"
