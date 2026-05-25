# FEATURE_STYLE_SPLIT_HOME_FEATURE_CSS_20260525

## 需求解读

- 用户要求开始进行前端样式拆分，将长期策略落到可执行代码改造。
- 当前风险点是首页样式大量堆积在 `app/globals.css`，模块边界不清晰，后续变更容易产生全局回归。
- 本次目标是先完成一个低风险、可验证的第一步：把首页专属样式从全局样式中拆分为独立 feature 样式文件。

## 修改方法

- 采用“最小行为变更”原则：不改类名、不改选择器优先级语义，只迁移样式位置。
- 在 `globals.css` 顶部引入 `@import "./styles/features/home.css"`，保持样式加载顺序可控。
- 将 `.page-home` 与 `.proto-home` 相关首页样式整块迁移到 feature 文件，保留 `globals.css` 中的通用样式与其它模块样式。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/home.css`
  - 承载首页专属样式：`.page-home`、`.proto-home`、首页响应式规则、首页专用 keyframes。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/home.css";`
  - 删除首页专属 `.page-home` 与 `.proto-home` 样式块。
  - 保留全局通用样式与非首页模块样式（如 verifier 样式）。

- 结果：完成样式边界拆分的第一步，首页样式已从全局文件迁移为 feature 级文件，后续可继续按模块逐步拆分。