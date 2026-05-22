# Climate Passport 目标库导入脚本记录

## 需求解读

- 继续推进迁移链路，不能只停在从 SHCW 源库导出 JSON。
- 需要补一条最小可执行的目标库导入入口，把已抽取的核心数据写入 Climate Passport。
- 为了保证事件导入不被外键阻断，第一版导入链路需要覆盖 `tracks -> users -> events -> registrations`。

## 修改方法

- 扩展源库抽取脚本，把 `tracks` 纳入标准化输出。
- 新增目标库导入脚本 `scripts/import-shcw-core.mjs`。
- 使用 Prisma Client 对目标库执行 upsert，保留源系统主键和历史时间戳。
- 补充环境变量模板，明确源库与目标库连接串。

## 修改内容

- 更新 `.env.example`
- 更新 `package.json`，新增 `migrate:core:import`
- 更新 `scripts/migrate-shcw-core.mjs`
- 新增 `scripts/import-shcw-core.mjs`
- 新增 `docs/MIGRATION_IMPORT_BOOTSTRAP_20260520.md`