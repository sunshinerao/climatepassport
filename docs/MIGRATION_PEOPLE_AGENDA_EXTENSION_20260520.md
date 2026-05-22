# Climate Passport 人物与议程迁移扩展记录

## 需求解读

- 在核心活动与参与数据已落地后，需要继续把 SHCW 的人物与议程内容迁移到 Climate Passport。
- 本轮目标是补齐 `institutions`、`event_institutions`、`speakers`、`speaker_roles`、`agenda_items`，并保留议程与嘉宾的多对多关系。
- 迁移实现必须对当前源库中的空表安全，例如本地 SHCW 源库当前 `institutions` 与 `event_institutions` 为 0 行时也不能影响整批导入。

## 修改方法

- 扩展 `scripts/migrate-shcw-core.mjs`，新增人物与议程相关 scope 的抽取逻辑。
- 从源库 `_AgendaItemToSpeaker` join table 提取 `AgendaItem -> Speaker` 关联，归一化为 `speakerIds` 数组。
- 扩展 `scripts/import-shcw-core.mjs`，按依赖顺序导入机构、嘉宾、嘉宾职务、议程项与活动机构关系。

## 修改内容

- 更新 `scripts/migrate-shcw-core.mjs`
- 更新 `scripts/import-shcw-core.mjs`
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
- 新增 `docs/MIGRATION_PEOPLE_AGENDA_EXTENSION_20260520.md`