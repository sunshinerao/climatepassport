# FEATURE_STYLE_SPLIT_SUMMER_SCHOOL_APPLICATION_20260525

## 需求解读

- 按既定顺序继续执行样式边界拆分，先完成 Summer School Application（Task 3）样式从 `globals.css` 到独立 feature 文件的迁移。
- 本次目标是先拆出主体视觉样式块，保留跨模块响应式覆写在后续阶段统一回流，避免一次性跨段改动引入回归。
- 迁移过程中不改选择器命名与视觉逻辑，仅做样式归属调整。

## 修改方法

- 采用区块边界整段迁移：按 Task 3 注释锚点提取 `ss-*` 主体样式区间到新文件，避免手动重写造成差异。
- 在 `globals.css` 顶部导入新 feature 样式文件，保持样式加载可控且顺序明确。
- 从 `globals.css` 删除已迁移主块，并修复边界注释残留，确保两端文件结构完整。
- 完成后执行静态错误检查与全量测试，确认拆分未影响既有行为。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/summer-school-application.css`
  - 承载 Summer School Application（Task 3）主体视觉样式块。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/summer-school-application.css";`
  - 删除 Task 3 主体 `ss-*` 样式块。
  - 修复 Task 4 区段注释头部，清除边界切分残留。

- 校验结果：
  - `get_errors`：`globals.css` 与 `summer-school-application.css` 均无错误。
  - 选择器检查：`globals.css` 中仅保留响应式段落内少量 `.ss-*` 覆写（后续 responsive 回流阶段处理）。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
