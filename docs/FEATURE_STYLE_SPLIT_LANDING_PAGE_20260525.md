# FEATURE_STYLE_SPLIT_LANDING_PAGE_20260525

## 需求解读

- 继续按已确认顺序执行样式拆分，在 Task 5 之后完成 Landing Page（Task 1）样式主块拆分。
- 目标是将 Landing 专属样式从 `globals.css` 独立出来，降低全局样式文件体积与跨模块耦合。
- 本次迁移仅调整样式归属，不改业务逻辑、选择器语义和视觉呈现。

## 修改方法

- 采用注释锚点整段迁移方式，将 Task 1 区块完整提取到独立 feature 文件。
- 在 `globals.css` 顶部 feature import 中注册新文件，保持加载顺序明确。
- 删除 `globals.css` 中 Task 1 主块，并修复边界切分产生的注释残留，确保后续 Task 2 注释头完整。
- 完成后执行错误检查与回归测试，确认拆分无回归。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/landing-page.css`
  - 承载 Landing Page（Task 1）主样式块（含 hero、how-it-works、events、feature-modules、cta-band 等段落）。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/landing-page.css";`
  - 删除 Task 1 主样式段。
  - 修复 Task 2 区段注释头完整性。

- 校验结果：
  - `get_errors`：`globals.css` 与 `landing-page.css` 均无错误。
  - 选择器检查：`globals.css` 中仅保留少量 `.landing-*` 响应式覆写（将在后续 responsive 回流阶段处理）。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
