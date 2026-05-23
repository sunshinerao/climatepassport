# Climate Passport 迁移范围扩展记录

## 需求解读

- 在核心 `tracks/users/events/registrations` 已迁通后，需要继续扩展 SHCW 到 Climate Passport 的真实迁移范围。
- 这一轮优先补足 Passport 与 Events 相关的关键业务链路数据：`event_verifiers`、`checkins`、`point_transactions`、`invitation_requests`、`special_passes`。
- 同时要修复抽取器当前对单个 PostgreSQL client 并发查询产生的弃用警告，避免后续批量抽取不稳定。

## 修改方法

- 扩展 `scripts/migrate-shcw-core.mjs` 的抽取范围，输出更多标准化 JSON 工件。
- 将抽取器改为使用 `pg.Pool`，避免单 client 并发查询警告。
- 扩展 `scripts/import-shcw-core.mjs`，把新增工件 upsert 到 Climate Passport 目标库。

## 修改内容

- 更新 `scripts/migrate-shcw-core.mjs`
- 更新 `scripts/import-shcw-core.mjs`
- 新增 `docs/MIGRATION_PARTICIPATION_EXTENSION_20260520.md`