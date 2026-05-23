# Climate Passport Prisma Schema 草案记录

## 需求解读

- 需要开始第 1 步，把 Climate Passport 的第一版 Prisma schema 草案落下来。
- 这份 schema 需要覆盖第一阶段核心平台能力，并同时纳入 Certificate Hub。
- 迁移原则仍然成立：优先兼容现有成熟功能的逻辑、字段和关系，先保证迁移安全与可验证，再逐步做语义优化。

## 修改方法

- 在新仓库根目录建立 `prisma/schema.prisma`。
- 优先覆盖第一阶段核心模型：用户、组织、活动、报名、签到、积分、嘉宾、议程、邀请函、Special Pass。
- 同时建立 Passport Ledger 的 Achievement、Milestone 与 Certificate Hub 模型。
- 补充 Prisma 相关脚本与环境变量模板，便于后续直接做校验与 generate。

## 修改内容

- 更新 `package.json`，加入 Prisma 相关依赖与脚本。
- 新增 `.env.example`
- 新增 `prisma/schema.prisma`
- 新增 `docs/PRISMA_SCHEMA_DRAFT_20260520.md`