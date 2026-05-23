# Climate Passport 迁移脚本脚手架记录

## 需求解读

- 按照既定顺序进入第 3 步，需要开始搭建迁移脚本，而不是只停留在文档层。
- 现阶段优先把迁移顺序、模块边界和环境变量约束固定下来，先形成 dry-run 骨架。
- 目标是为下一步接入旧库读取、数据规范化和目标库 upsert 留出稳定入口。

## 修改方法

- 新增可执行脚本 `scripts/migrate-shcw-core.mjs`。
- 先以 dry-run 模式输出迁移阶段和模型覆盖范围。
- 在执行模式下预留源库和目标库环境变量校验，防止后续直接误跑。

## 修改内容

- 新增 `scripts/migrate-shcw-core.mjs`
- 更新 `package.json`，加入 `migrate:core:dry-run` 脚本
- 新增 `docs/MIGRATION_SCRIPT_BOOTSTRAP_20260520.md`