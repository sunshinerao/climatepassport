# CHANGE_CLIMATE_PASSPORT_QR_WIDTH_EXPANSION_20260526

## 需求解读

用户要求继续调整 Climate Passport 顶部二维码区域宽度，目标是让“护照核验码”和护照编号在同一行完整显示，不发生折行或截断。

## 修改方法

1. 增大二维码卡片容器宽度，并同步微调内边距。
2. 在核验码信息行强制单行布局，避免因容器压缩触发换行。
3. 取消护照编号的截断限制（ellipsis），确保完整可见。
4. 同步更新移动端断点下的最大宽度，保持规则一致。

## 修改内容

1. 样式文件调整
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 关键变更：
  - `passport-dashboard-hero-qr-frame` 宽度由 `172px` 调整为 `300px`。
  - `passport-dashboard-hero-qr-code-line` 增加 `flex-wrap: nowrap`。
  - `passport-dashboard-hero-qr-code-line span` 增加 `white-space: nowrap`。
  - `passport-dashboard-hero-qr-code-line strong` 移除 `max-width` 与文本截断逻辑，保留单行显示。
  - 移动端 `max-width` 由 `172px` 调整为 `300px`。

2. 预期结果
- “护照核验码 + 护照编号”在一行内完整展示。
- 二维码区域回到可读性更高的宽度，不影响其它模块结构。