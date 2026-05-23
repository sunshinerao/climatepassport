# Prisma 环境变量加载修复（2026-05-23）

## 需求解读
- 线上功能表现为登录接口返回 `Database unavailable`（503），阻断了登录和需要数据库的后台功能。
- 目标是自动定位根因，修复后通过浏览器自动化与代码测试验证功能恢复。

## 修改方法
1. 先定位数据库客户端初始化逻辑，确认 `getPrismaClient` 仅依赖 `DATABASE_URL`，且应用目录缺少 `.env`。
2. 在 Prisma 初始化层增加环境变量兜底与 monorepo `.env` 自动解析：
   - 优先使用已存在的 `DATABASE_URL`。
   - 否则尝试解析当前目录、上级目录、上上级目录的 `.env`。
   - 支持 `CLIMATE_PASSPORT_DATABASE_URL` 作为回退来源。
3. 重启开发服务，用浏览器自动化复测登录路径，确认错误类型从 503 变为正常鉴权返回。
4. 执行 `npm test`、`npm run lint`、`npm run build` 做回归验证。

## 修改内容
- 修改文件：`apps/passport-web/lib/server/prisma.ts`
- 关键改动：
  - 新增 `.env` 候选路径自动探测与解析。
  - 新增字符串去引号处理，兼容 `KEY="value"` 和 `KEY='value'`。
  - 新增 `CLIMATE_PASSPORT_DATABASE_URL -> DATABASE_URL` 回退逻辑。
  - 在 `getPrismaClient` 前执行 `ensureDatabaseEnv()`，避免环境变量未初始化导致直接返回 `null`。

## 验证结果
- 浏览器自动化复测：
  - 登录提交由 `503 Database unavailable` 变为 `401 Invalid email or password`（符合无效凭据预期）。
- 代码测试：
  - `npm test` 通过（20/20）。
  - `npm run lint` 通过。
  - `npm run build` 通过（172/172 页面生成）。

## 尚未完成
- 仍需在后续阶段补充“已登录态后台操作”自动化验证（依赖可用测试账号与数据库数据）。
