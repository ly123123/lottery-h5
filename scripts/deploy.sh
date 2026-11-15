#!/usr/bin/env bash
# 一键发布到 GitHub Pages
set -euo pipefail

REPO_NAME="${1:-lottery-h5}"
VISIBILITY="${2:-public}"
cd "$(dirname "$0")/.."

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ 未登录 GitHub，请先执行：gh auth login"
  exit 1
fi

OWNER=$(gh api user --jq .login)
echo "▸ 账号：$OWNER"

if ! gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "▸ 创建仓库 $OWNER/$REPO_NAME ($VISIBILITY)"
  gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin --push
else
  echo "▸ 仓库已存在，推送更新"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
  git push -u origin main
fi

echo "▸ 启用 GitHub Pages (GitHub Actions)"
gh api -X POST "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 || \
  gh api -X PATCH "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 || true

echo "✅ 完成，几分钟后访问：https://$OWNER.github.io/$REPO_NAME/"
