# FEATURE_STYLE_SPLIT_SUMMER_SCHOOL_ADMIN_20260525

## 需求解读

- 继续推进样式边界拆分，将夏校申请管理页 `ssa-*` 样式从 `globals.css` 中拆出到独立 feature 样式文件。
- 目标是减少全局样式耦合，确保夏校管理模块样式具备独立维护边界，降低后续改动引发的跨页面风险。
- 本次迁移保持样式选择器与视觉行为不变，仅调整样式归属文件。

## 修改方法

- 采用整段迁移策略：按 `ssa-*` 注释区块边界整体提取，避免手动重写导致差异。
- 在 `globals.css` 顶部新增 feature 样式导入，维持既有拆分加载顺序。
- 删除 `globals.css` 中原 `ssa-*` 样式段，保持全局文件只保留未拆分样式。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/summer-school-admin.css`
  - 承载夏校申请管理模块 `ssa-*` 样式及其响应式规则。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/summer-school-admin.css";`
  - 删除原 `ssa-*` 样式段落。

- 校验结果：
  - `globals.css` 中 `.ssa-` 选择器计数为 `0`。
  - `summer-school-admin.css` 中 `.ssa-` 选择器计数为 `41`。
