# Certificate Hub 需求确认记录

## 需求解读

- Climate Passport 平台中必须新增独立的 Certificate Hub。
- Certificate Hub 需要覆盖：证书分类、名称、模板设定、生成、审批、验证、下载等完整功能。
- Certificate Hub 不能孤立存在，需要与 Climate Passport 的成就、积分、里程碑等能力关联。
- 迁移过程中，原系统中成熟的功能应尽可能不改变既有逻辑、界面和交互结构。

## 修改方法

- 更新平台架构文档，将 Certificate Hub 升格为明确的平台域模块。
- 更新模块迁移矩阵和数据映射文档，把 Certificate Hub 纳入后续 schema 设计范围。
- 更新总 tracker，并为 Certificate Hub 单独建立模块级 pending features tracker。
- 明确记录“成熟功能不轻易改逻辑和界面”的迁移约束，避免后续设计偏离。

## 修改内容

- 更新 `docs/PLATFORM_ARCHITECTURE_20260518.md`
- 更新 `docs/MODULE_MIGRATION_MATRIX_20260520.md`
- 更新 `docs/SOURCE_TO_TARGET_DATA_MAPPING_20260520.md`
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
- 新增 `docs/CERTIFICATE_HUB_PENDING_FEATURES_TRACKER.md`
- 新增 `docs/CERTIFICATE_HUB_REQUIREMENTS_20260520.md`