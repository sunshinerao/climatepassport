# CHANGE_PRISMA_MIGRATION_SYNC_20260526

## 需求解读

本次需求包括两部分：

1. 立即执行 Prisma migration，确保当前数据库与代码中的迁移一致。
2. 固化推送到远端时的数据库同步要求，避免“代码已推送但数据库未迁移”导致的运行时错误。

## 修改方法

1. 在仓库根目录执行 Prisma 迁移与状态校验，确认 migration 已成功应用。
2. 在根 `package.json` 增加可复用的数据库同步脚本，统一推送前与发布流程命令。
3. 在 `README.md` 增加“Before Push / Remote Deploy”的数据库同步规则，明确执行顺序。

## 修改内容

1. 执行迁移与校验
- 执行：`npx prisma migrate deploy --schema prisma/schema.prisma`
- 结果：成功应用 `20260526120000_achievement_badge_system`
- 校验：`npx prisma migrate status --schema prisma/schema.prisma` 返回 `Database schema is up to date!`

2. 新增脚本（`package.json`）
- `db:migrate:deploy`: `prisma migrate deploy --schema prisma/schema.prisma`
- `db:migrate:status`: `prisma migrate status --schema prisma/schema.prisma`
- `db:sync`: `npm run db:migrate:deploy && npm run db:migrate:status`

3. README 规则补充
- 新增 `Database Sync Rule (Before Push / Remote Deploy)` 章节。
- 明确本地推送前顺序：
  1) `npm run db:sync`
  2) `npm run build`
  3) `npm test`
- 明确远端发布顺序：
  1) `npm ci`
  2) `npm run db:migrate:deploy`
  3) `npm run build`
  4) 重启应用进程
- 补充说明：未迁移远端数据库可能触发 Prisma `P2021`。
