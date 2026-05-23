# Climate Passport 源库抽取脚本记录

## 需求解读

- 继续推进第 3 步，不能只保留 dry-run 说明，需要开始真正从 SHCW 源库读取数据。
- 第一阶段先覆盖最关键的三类核心数据：`users`、`events`、`registrations`。
- 当前目标是先输出标准化 JSON 抽取结果，作为后续 upsert 写入 Climate Passport 目标库的输入物。

## 修改方法

- 扩展 `scripts/migrate-shcw-core.mjs`，保留原有 dry-run，同时新增 extract-only 模式。
- 使用 PostgreSQL 客户端直连 SHCW 源库，读取核心表并标准化为 JSON。
- 输出 `manifest.json`、`users.json`、`events.json`、`registrations.json` 到可配置目录，便于后续审计和断点重跑。

## 修改内容

- 更新 `package.json`，新增 `migrate:core:extract`
- 更新 `scripts/migrate-shcw-core.mjs`
- 新增 `docs/MIGRATION_EXTRACTION_BOOTSTRAP_20260520.md`