# BUGFIX_HOME_EVENTS_BUTTON_AND_FEATURES_TAIL_SPACING_20260525

## 需求解读

- 用户反馈首页“近期活动”板块（第四部分）卡片中的“了解更多”按钮，出现与 Hero 区“探索活动”相同的 hover 可读性问题，需要同类修复。
- 用户要求第六部分“功能”板块尾部留白，与第五部分尾部留白高度保持一致。
- 需保持改动仅作用于首页，避免影响其他页面按钮样式。

## 修改方法

- 在首页样式作用域 `.proto-home` 下，对活动卡片按钮新增显式 hover/focus 可读性规则，覆盖潜在全局 hover 叠加导致的视觉不稳定。
- 对第5/6部分（events/features）在主样式和断点样式中显式对齐底部留白值，确保不同视口下始终一致。
- 修改后执行样式检查、页面计算样式验证（zh/en）与测试回归。

## 修改内容

- 修改文件：`apps/passport-web/app/styles/features/home.css`
  - 新增活动卡片按钮可见性保护：
    - `.proto-home .events .event-btn:hover, .proto-home .events .event-btn:focus-visible`
    - 显式设置可读文字色、浅色背景与边框色，避免 hover 时出现白字不可见风险。
  - 明确第5/6部分尾部留白一致：
    - 在 `@media (max-width: 980px)` 与 `@media (max-width: 640px)` 中显式将 `.events` 与 `.features` 的 `padding-bottom` 设为同值（分别为 `36px`、`28px`）。

- 验证结果：
  - `home.css` 无语法错误。
  - `/zh` 与 `/en` 首页活动卡片按钮 hover 计算样式可读，未出现白字不可见。
  - `/zh` 与 `/en` 首页 `events` 与 `features` 的 `padding-bottom` 计算值一致（当前视口下均为 `28px`）。
  - `npm test`：`38 passed / 0 failed`。
