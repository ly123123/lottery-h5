# GitHub 发布 H5 / PWA 标准流程

> 沉淀于 2026-11-15「智选号码」项目（https://ly123123.github.io/lottery-h5/）。
> 后续更新 H5 或新增 H5 应用，照此执行即可。

---

## 0. 一句话结论

```
main 分支放源码  →  gh-pages 分支放构建产物  →  Pages 从 gh-pages 发布
```

**不用 GitHub Actions**，因为 OAuth 授权拿不到 `workflow` 权限，推不了 `.github/workflows/*`。

---

## 1. 本机环境的三个硬约束（决定了流程长什么样）

| 约束 | 报错原文 | 后果 | 应对 |
| --- | --- | --- | --- |
| 不能写 `~/.config` | `mkdir /Users/leo/.config/gh: operation not permitted` | `gh auth login` 无法写默认配置 | 用 `GH_CONFIG_DIR` 指向可写目录 |
| 不能创建伪终端 | `script: openpty: Operation not permitted` | 无法给 `gh` 造 TTY | 用 `gh auth login --web < /dev/null`，它会在非 TTY 下直接进入设备码流程 |
| 无 git credential helper | `fatal: could not read Username` | `git push` 无法认证 | 把 token 注入 remote URL |

---

## 2. 标准流程（5 步）

### 步骤 1：申请设备授权码

```bash
export GH_CONFIG_DIR=/Users/leo/Documents/depseek/.gh-config   # 必须放仓库目录之外！
export HTTPS_PROXY=http://127.0.0.1:7897                        # GitHub 需要代理
export BROWSER=echo                                             # 阻止弹出浏览器
mkdir -p "$GH_CONFIG_DIR"
gh auth login --hostname github.com --git-protocol https --web < /dev/null
```

输出：
```
! First copy your one-time code: XXXX-XXXX
Open this URL to continue in your web browser: https://github.com/login/device
```

> ⚠️ **不要用**第三方 client_id 自己调 `/login/device/code`（如 `Iv1.b507a08c87ecfe98`）。
> 实测拿到的 token 的 `x-oauth-scopes` 为空，只能读公开信息，建仓/推送全部 403。

### 步骤 2：用户在手机/电脑上授权

打开 https://github.com/login/device → 输入 8 位码 → **Authorize github**

成功后终端出现：
```
✓ Logged in as <用户名>
```

授权有效期约 15 分钟，过期重新执行步骤 1。

### 步骤 3：建仓库 + 推源码

```bash
TOKEN=$(sed -n 's/.*oauth_token: *//p' "$GH_CONFIG_DIR/hosts.yml" | head -1)

# 建仓（--public 才能免费用 Pages）
gh repo create <仓库名> --public --source=. --remote=origin

# 推送（关键：token 直接写进 URL，本机没有 credential helper）
git remote set-url origin "https://x-access-token:$TOKEN@github.com/<用户名>/<仓库名>.git"
git push -u origin main
```

如果仓库已存在，跳过 `repo create`。

### 步骤 4：推静态产物到 gh-pages

```bash
# 1) 构建并拷贝产物
npm run build
rm -rf deploy-static && mkdir -p deploy-static
cp -R dist/. deploy-static/
touch deploy-static/.nojekyll          # 阻止 Jekyll 忽略下划线开头的文件

# 2) 在临时目录建独立仓库推送，避免污染主工作区
rm -rf /tmp/ghp && mkdir -p /tmp/ghp && cd /tmp/ghp
git init -q && git config user.name leo && git config user.email leo@local
cp -R "<项目路径>/deploy-static/." .
touch .nojekyll
git add -A && git commit -q -m "发布静态站点"
git remote add origin "https://x-access-token:$TOKEN@github.com/<用户名>/<仓库名>.git"
git push -f origin HEAD:gh-pages
```

> ⚠️ **绝对不要**在主工作区直接 `git checkout --orphan gh-pages && git rm -rf .`。
> 本项目曾这样操作，把 `node_modules` 和 `.gh-config` 一起删掉了，得重装依赖 + 重新授权。

### 步骤 5：开启 Pages + 验证

```bash
gh api -X POST repos/<用户名>/<仓库名>/pages \
  -f "source[branch]=gh-pages" -f "source[path]=/"
```

返回 409 说明已启用，用 `PUT` 更新即可。

地址：`https://<用户名>.github.io/<仓库名>/`（首次约 15~90 秒生效）

---

## 3. 前端必须做对的 4 件事

### 3.1 `base` 用相对路径

```ts
// vite.config.ts
export default defineConfig({ base: './' })
```

否则项目页部署在 `/仓库名/` 子路径下会白屏。

### 3.2 PWA 四件套

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<link rel="manifest" href="./manifest.webmanifest">
```

manifest 至少要：`name`、`short_name`、`start_url: "./"`、`scope: "./"`、`display: "standalone"`、192/512 图标。

**iOS 必须 HTTPS + apple-touch-icon 才能「添加到主屏幕」并全屏运行。**

### 3.3 Service Worker 注册用相对 base

```ts
navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
```

### 3.4 图标生成（Pillow，无需设计软件）

```python
from PIL import Image, ImageDraw
# 生成 192 / 512 / 180(apple-touch) / 512(maskable) 四张
```

maskable 版本四周要留安全边距，否则 iOS 圆角会切掉内容。

---

## 4. 上线前验证清单（必做）

```bash
# ① 资源全 200
curl -s -o /dev/null -w '%{http_code}' https://<用户>.github.io/<仓库>/
curl -s -o /dev/null -w '%{http_code}' https://<用户>.github.io/<仓库>/manifest.webmanifest
curl -s -o /dev/null -w '%{http_code}' https://<用户>.github.io/<仓库>/sw.js
```

```js
// ② 用 puppeteer-core 检查 PWA 条件（Chrome 需 --proxy-server）
{
  https: true,                        // 必须 true
  sw: 'active',                       // SW 必须 active
  display: 'standalone',              // manifest 显示模式
  icons: 3,                           // 图标数量
  appleIcon: true, appleCapable: true // iOS 安装前提
}
```

③ 子路径验证：把 `dist` 放到 `/tmp/x/<仓库名>/`，用 `python3 -m http.server` 起服务，
访问 `http://127.0.0.1:8099/<仓库名>/`，确认无 404。

④ 离线验证：`page.setOfflineMode(true)` 后 `reload()`，页面仍能渲染。

---

## 5. 新增 H5 应用的模板清单

```
新项目/
├── package.json          # vite + react + ts
├── vite.config.ts        # base: './'
├── index.html            # PWA meta 四件套
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js             # 导航 network-first，资源 cache-first
│   └── icons/            # 192 / 512 / 180 / maskable-512
├── src/
└── scripts/
    ├── publish.sh        # 见下方通用脚本
    └── shot.mjs          # puppeteer 截图验证
```

---

## 6. 通用发布脚本

已放在 `scripts/publish.sh`，任何同结构项目复制过去改 `REPO` 常量即可：

```bash
./scripts/publish.sh          # 构建 + 推送 gh-pages + 打印地址
```

---

## 7. 故障排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `refusing to allow an OAuth App to create or update workflow` | token 无 `workflow` scope | 不推 `.github/`，改用 gh-pages 分支 |
| `fatal: could not read Username` | 无 credential helper | remote URL 里嵌 token |
| `mkdir ~/.config/gh: operation not permitted` | 沙箱限制 | `export GH_CONFIG_DIR=<可写目录>` |
| `script: openpty: Operation not permitted` | 无法造 TTY | 用 `gh auth login --web < /dev/null` |
| Pages 404 | 分支/目录选错，或未等构建 | 检查 `source.branch=gh-pages`、`path=/`，等 90 秒 |
| 页面白屏但 200 | `base` 不是 `'./'` | 改成相对路径重新构建 |
| 图标模糊/被裁 | 缺 maskable 或尺寸不足 | 补 512 maskable + 180 apple-touch |
| Safari 无「添加到主屏幕」 | 非 HTTPS 或非 Safari | 必须 https + Safari 浏览器 |

---

## 8. 备注：临时联网预览（需要时再看）

如果想在**没有 Pages 的情况下**让手机临时访问：

```bash
# 1) 本地服务
npx vite preview --host 0.0.0.0 --port 4173

# 2) cloudflared 临时隧道（免注册，地址随机、每次重启会变）
./tools/cloudflared tunnel --url http://127.0.0.1:4173 --no-autoupdate --protocol http2
```

> ⚠️ Vite 默认拦截外部域名，必须先在 `vite.config.ts` 加：
> `preview: { allowedHosts: ['.trycloudflare.com'] }`，否则返回 403
> `Blocked request. This host is not allowed.`

这种地址是临时的，**装到主屏后一旦域名失效就打不开**，只适合预览，不要作为长期方案。

---

## 9. 安全提醒

- token 明文存在 `/Users/leo/Documents/depseek/.gh-config/hosts.yml`
- **必须**确保该目录在 `.gitignore` 里，且位于仓库目录之外
- 授权可在 https://github.com/settings/applications 随时撤销
- token 会过期，过期后重新走步骤 1
