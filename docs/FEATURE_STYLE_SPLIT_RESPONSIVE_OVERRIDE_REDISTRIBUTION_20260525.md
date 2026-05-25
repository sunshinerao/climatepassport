# FEATURE_STYLE_SPLIT_RESPONSIVE_OVERRIDE_REDISTRIBUTION_20260525

## 需求解读

- 进入下一阶段：将 `globals.css` 中 `Responsive overrides for new components` 按模块归属回流到各 feature 样式文件。
- 目标是让全局文件不再承载该跨模块响应式段，进一步收敛为基础/共享层职责。
- 本次迁移保持视觉行为不变，仅调整响应式规则归属位置。

## 修改方法

- 按选择器归属拆分响应式规则：`landing-* / how-* / stats-* / cta-*` 回流到 Landing；`ss-*` 回流到 Summer School；`dash-*` 回流到 Dashboard；`cert-mgr-*` 回流到 Admin Certificate；`field-row*` 回流到 Registration。
- 在各 feature 文件内新增对应 `@media` 规则，保持断点与原值一致（980/720）。
- 从 `globals.css` 删除 `Responsive overrides for new components` 整段。
- 执行错误检查与回归测试，确认迁移稳定。

## 修改内容

- 修改文件：`apps/passport-web/app/styles/features/landing-page.css`
  - 新增 980/720 断点下的 landing/how/stats/cta 响应式规则。

- 修改文件：`apps/passport-web/app/styles/features/summer-school-application.css`
  - 新增 980/720 断点下的 `ss-*` 和 `check-card-grid` 响应式规则。

- 修改文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 新增 980/720 断点下的 `dash-points-row` 响应式规则。

- 修改文件：`apps/passport-web/app/styles/features/admin-certificate-management.css`
  - 新增 980 断点下的 `cert-mgr-grid` 响应式规则。

- 修改文件：`apps/passport-web/app/styles/features/enhanced-registration-form.css`
  - 新增 720 断点下的 `field-row` / `field-row-3` 响应式规则。

- 修改文件：`apps/passport-web/app/globals.css`
  - 删除 `Responsive overrides for new components` 整段。

- 校验结果：
  - `get_errors`：相关 6 个 CSS 文件均无错误。
  - 检索验证：`globals.css` 中不再包含上述回流选择器的目标响应式段。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
