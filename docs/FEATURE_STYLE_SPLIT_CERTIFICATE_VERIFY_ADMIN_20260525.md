# FEATURE_STYLE_SPLIT_CERTIFICATE_VERIFY_ADMIN_20260525

## 需求解读

- 继续执行样式拆分计划第 2 批与第 3 批：把证书验证页面（`cpv-`）与证书管理页面（`cpca-`）从全局样式中独立出去。
- 目标是在不改变现有页面行为和视觉结果的前提下，收敛 `globals.css` 的模块耦合，落实 Feature 层样式边界。
- 需要在拆分后完成回归检查，确保路由和关键业务用例不回归。

## 修改方法

- 采用“选择器不变、位置迁移”的安全策略：保留原样式内容，迁移到 feature 样式文件并通过 `@import` 接入。
- 把 `cpca` 主样式块与 `proto-admin-main` 下 `cpca` 排版归一块一并迁移到证书管理 feature 样式文件，避免跨文件依赖断裂。
- 把 `cpv` 样式块整体迁移到证书验证 feature 样式文件。
- 在 `globals.css` 顶部统一引入新 feature 样式，保证加载顺序稳定。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/certificate-admin.css`
  - 承载证书管理相关样式：`.cpca-*` 及 `.proto-admin-main .cpca-*` 排版归一规则。

- 新增文件：`apps/passport-web/app/styles/features/certificate-verify.css`
  - 承载证书验证相关样式：`.cpv-*` 与其响应式规则。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：
    - `@import "./styles/features/certificate-admin.css";`
    - `@import "./styles/features/certificate-verify.css";`
  - 删除已迁移的 `cpca` 与 `cpv` 样式块。

- 迁移结果校验：
  - `globals.css` 中 `.cpca-` 计数为 0；`.cpv-` 计数为 0。
  - feature 文件中保留完整样式选择器计数（`cpca` 216，`cpv` 98）。