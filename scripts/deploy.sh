#!/usr/bin/env bash
# 一键发布到 GitHub Pages（在你自己登录过 gh 的终端里执行）
set -euo pipefail

REPO_NAME="${1:-lottery-h5}"
VISIBILITY="${2:-public}"
cd "$(dirname "$0")/.."

echo "════════════════════════════════════════"
echo "  智选号码 · GitHub Pages 发布"
echo "════════════════════════════════════════"

# 1. 认证检查
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ 当前终端未登录 GitHub"
  echo "   请先执行：gh auth login"
  echo "   （GitHub.com → HTTPS → Yes → Login with a web browser → 输入 8 位授权码）"
  exit 1
fi
OWNER=$(gh api user --jq .login)
echo "▸ 账号：$OWNER"

# 2. git 身份（缺失时补上，避免 commit 失败）
git config user.name  >/dev/null 2>&1 || git config user.name  "$OWNER"
git config user.email >/dev/null 2>&1 || git config user.email "$OWNER@users.noreply.github.com"
echo "▸ 提交者：$(git config user.name) <$(git config user.email)>"

# 3. 确保分支为 main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  git branch -M main
  echo "▸ 分支已重命名为 main"
fi

# 4. 提交未提交的改动
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "更新：$(date '+%Y-%m-%d %H:%M')"
  echo "▸ 已提交本地改动"
fi

# 5. 创建或复用远程仓库
if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "▸ 仓库已存在：$OWNER/$REPO_NAME"
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
  fi
  git push -u origin main
else
  echo "▸ 创建仓库：$OWNER/$REPO_NAME ($VISIBILITY)"
  gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin --push
fi

# 6. 启用 GitHub Pages（工作流模式）
echo "▸ 启用 GitHub Pages（GitHub Actions 模式）"
if ! gh api "repos/$OWNER/$REPO_NAME/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 || true
else
  gh api -X PATCH "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 || true
fi

# 7. 等待 Actions 跑完
echo "▸ 等待 GitHub Actions 构建部署（约 1-2 分钟）"
sleep 8
RUN_ID=$(gh run list --repo "$OWNER/$REPO_NAME" --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")
if [ -n "$RUN_ID" ]; then
  gh run watch "$RUN_ID" --repo "$OWNER/$REPO_NAME" --exit-status >/dev/null 2>&1 || true
fi

URL="https://$OWNER.github.io/$REPO_NAME/"
echo ""
echo "════════════════════════════════════════"
echo "  ✅ 发布完成"
echo ""
echo "  访问地址：$URL"
echo ""
echo "  iPhone 安装：Safari 打开上面地址"
echo "  → 底部「分享」→「添加到主屏幕」→「添加」"
echo "════════════════════════════════════════"
