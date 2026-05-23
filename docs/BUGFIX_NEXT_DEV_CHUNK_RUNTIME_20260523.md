# Next.js 开发态 Chunk 丢失问题修复（2026-05-23）

## 需求解读
- 开发环境出现 `MODULE_NOT_FOUND`，典型报错包含 `.next/server` 下的 chunk 文件缺失（例如 `./vendor-chunks/@swc.js`、`./3135.js`）。
- 该问题会导致多个业务路由在开发态返回 500，影响调试与联调效率。
- 目标是在不扩大改动面的前提下，稳定开发态产物，避免 dev/build 产物互相污染。

## 修改方法
1. 分析 Next 配置，确认当前使用默认 `distDir`（`.next`），开发与构建共用同一输出目录。
2. 在 `next.config.mjs` 增加环境区分：
   - 开发态输出到 `.next-dev`；
   - 生产构建继续使用 `.next`。
3. 增加 `allowedDevOrigins` 以兼容本地常见访问来源（`localhost` 与 `127.0.0.1`）。
4. 清理旧输出目录后重启开发服务，并对此前报错路由进行浏览器回归验证。

## 修改内容
- 修改文件：`apps/passport-web/next.config.mjs`
- 关键变更：
  - 新增 `isDev` 判断。
  - 新增 `distDir: isDev ? ".next-dev" : ".next"`。
  - 新增 `allowedDevOrigins: ["localhost", "127.0.0.1"]`。

## 验证结果
- 浏览器回归（本地）：
  - `/en/dashboard/certificates`：正常重定向到登录页（非 500）。
  - `/en/admin/certificates/records`：正常重定向到登录页（非 500）。
  - `/verify/certificate/NO-SUCH-CODE`：正常展示“Certificate not found”页面（非 500）。
- 结论：此前“chunk/module not found 导致 500”问题在当前验证路径上已消失。

## 尚未完成
- 本轮终端执行中 `npm test` / `npm run lint` / `npm run build` 未拿到稳定可见输出，建议在你当前本地会话再补跑一次三项命令作为最终回归留档。
