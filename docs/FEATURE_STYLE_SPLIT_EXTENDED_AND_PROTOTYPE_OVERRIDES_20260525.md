# FEATURE_STYLE_SPLIT_EXTENDED_AND_PROTOTYPE_OVERRIDES_20260525

## 需求解读

- 继续执行后续样式拆分，将 `globals.css` 中剩余的大块样式进一步下沉到独立文件。
- 本次重点包含两部分：`Extended component system`（共享组件层）与 `Prototype alignment overrides`（原型对齐覆写层）。
- 目标是继续收缩全局文件职责，避免全局样式继续承载模块/主题级样式聚合。

## 修改方法

- 按区块注释锚点整段提取，避免人工重写引入差异。
- 将共享组件块迁移到 shared 目录；将原型覆写块迁移到 feature 目录。
- 在 `globals.css` 顶部新增 import 并删除对应源区块，保持行为不变。
- 完成后执行错误检查与回归测试，确认无回归。

## 修改内容

- 新增目录：`apps/passport-web/app/styles/shared/`

- 新增文件：`apps/passport-web/app/styles/shared/extended-components.css`
  - 承载原 `Extended component system` 整段内容（含组件系统与其响应式规则）。

- 新增文件：`apps/passport-web/app/styles/features/prototype-alignment-overrides.css`
  - 承载原 `Prototype alignment overrides` 整段内容。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/shared/extended-components.css";`
  - 新增导入：`@import "./styles/features/prototype-alignment-overrides.css";`
  - 删除原 2 个大区块（含中间重复的 `New homepage + footer responsive overrides` 段）。

- 校验结果：
  - `get_errors`：`globals.css`、`extended-components.css`、`prototype-alignment-overrides.css` 均无错误。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
