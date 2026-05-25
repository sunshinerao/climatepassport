# FEATURE_STYLE_SPLIT_CERTIFICATE_USER_20260525

## 需求解读

- 继续执行样式边界拆分，将证书用户页 `cpu-*` 样式从全局样式中迁出。
- 当前问题是 `globals.css` 承载过多证书模块样式，模块隔离不足，后续迭代容易产生跨页面回归风险。
- 本次目标是在不改变页面行为和视觉表现的前提下，将证书用户页样式归档到独立 feature 样式文件。

## 修改方法

- 采用“选择器保持不变，仅迁移样式位置”的低风险迁移策略。
- 把 `cpu-*` 样式块整体迁移到 `certificate-user.css`，并在 `globals.css` 顶部通过 `@import` 接入。
- 删除 `globals.css` 中已迁移段落，保持全局文件只保留通用与非 `cpu` 模块样式。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/certificate-user.css`
  - 承载证书用户页相关样式：`.cpu-*` 及其响应式规则。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/certificate-user.css";`
  - 删除原 `cpu-*` 样式块。

- 拆分结果校验：
  - `globals.css` 中 `.cpu-` 选择器计数为 `0`。
  - `certificate-user.css` 中 `.cpu-` 选择器计数为 `105`。
