#!/usr/bin/env bash
# 重新构建并发布到 GitHub Pages（gh-pages 分支）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONF=/Users/leo/Documents/depseek/.gh-config
if [ ! -f "$CONF/hosts.yml" ]; then
  echo "❌ 未找到 GitHub 认证，请先执行："
  echo "   export GH_CONFIG_DIR=$CONF && gh auth login --web"
  exit 1
fi
TOKEN=$(sed -n 's/.*oauth_token: *//p' "$CONF/hosts.yml" | head -1)

echo "▸ 类型检查与构建"
npx tsc --noEmit
npm run build

echo "▸ 同步静态目录"
rm -rf deploy-static && mkdir -p deploy-static
cp -R dist/. deploy-static/
touch deploy-static/.nojekyll

echo "▸ 推送 gh-pages"
rm -rf /tmp/ghp && mkdir -p /tmp/ghp
cd /tmp/ghp
git init -q
git config user.name leo
git config user.email leo@local
cp -R "$ROOT/deploy-static/." .
touch .nojekyll
git add -A
git commit -q -m "更新发布 $(date '+%Y-%m-%d %H:%M')"
git remote add origin "https://x-access-token:${TOKEN}@github.com/ly123123/lottery-h5.git"
git push -f origin HEAD:gh-pages

echo ""
echo "✅ 已发布：https://ly123123.github.io/lottery-h5/"
echo "   （Pages 约 30 秒后生效，手机上重新打开即可）"
