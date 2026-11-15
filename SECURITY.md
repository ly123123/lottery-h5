# 安全说明

## 设计原则

- **纯前端静态站点**：无后端、无数据库、无服务端接口，不存在服务器被入侵导致数据泄露的风险
- **零数据收集**：不采集任何个人信息，详见 [PRIVACY.md](PRIVACY.md)
- **零网络依赖**：运行时不发起网络请求，断网可用
- **依赖最小化**：生产依赖仅 `react` 与 `react-dom` 两个

## 依赖安全

```bash
npm audit --registry=https://registry.npmjs.org
# found 0 vulnerabilities
```

构建工具链已升级至 Vite 8 / @vitejs/plugin-react 6，修复了
esbuild dev server 的任意来源请求漏洞（GHSA-67mh-4wv8-2f99）。

## 部署安全

- 仓库中**不含任何凭证、私钥或个人信息**
- 发布脚本从仓库外的 `GH_CONFIG_DIR` 读取 token，使用后即从 remote URL 移除
- `.gitignore` 已排除 `node_modules`、`dist`、`certs`、`.gh-config` 等

## 报告问题

发现安全问题请通过仓库的 Security 标签页私下报告，不要在公开 Issue 中披露细节。
