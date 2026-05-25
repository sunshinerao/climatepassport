# 需求解读
夏校申请提交成功后，成功图标与下方按钮在页面上不可见，需要修复成功态可视性问题，并保持原有交互流程不变。

# 修改方法
定位成功态渲染结构发现其脱离 `.ss-layout` 容器后，依赖的 Summer School 主题变量作用域失效。采用最小改动策略：仅在成功态涉及的按钮与图标样式上增加变量 fallback 值，避免改动组件结构和提交流程。

# 修改内容
- 文件：[apps/passport-web/app/styles/features/summer-school-application.css](apps/passport-web/app/styles/features/summer-school-application.css)
- 为 `.ss-form-card .button`、`.ss-form-card .button:hover` 增加 `--ss-amber` / `--ss-amber-dark` fallback。
- 为 `.ss-form-card .button-outline` 及其 hover 状态增加 `--ss-ink-soft`、`--ss-border`、`--ss-forest` fallback。
- 为 `.ss-submit-success .success-icon` 的渐变背景增加 `--ss-verify-green` fallback。
- 结果：即使成功态不在 `.ss-layout` 作用域中，图标和按钮仍能保持可见。
