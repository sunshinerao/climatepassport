# CHANGE_CLIMATE_PASSPORT_QR_COMPACT_ALIGNMENT_20260526

## 需求解读

用户要求继续微调 Climate Passport 顶部右侧二维码区：

1. 二维码区域缩小至当前约一半，且视觉上不超过左侧 Passport ID 所在行的层级。
2. 去掉二维码区中的“身份二维码”文案。
3. “护照核验码”字号与“成就时间线”标题字号保持一致。
4. “全场通用”与下方说明文字字号与左侧“积分”标签字号保持一致。

## 修改方法

1. 在组件层删除“身份二维码”节点，避免仅靠样式隐藏导致结构冗余。
2. 在样式层压缩二维码卡片尺寸、内边距、二维码画布圆角与间距。
3. 统一字号基准：
- “护照核验码”使用 `var(--cp-title-md)`。
- “全场通用”和说明文字使用 `11px`（与左侧“积分”标签一致）。

## 修改内容

1. 组件修改
- 文件：`apps/passport-web/components/platform-screens.tsx`
- 内容：删除 `passport-dashboard-hero-qr-eyebrow` 节点（“身份二维码”）。

2. 样式修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 内容：
  - `passport-dashboard-hero-qr-frame` 宽度由 `338px` 调整为 `172px`，并同步缩减圆角、内边距和阴影。
  - `passport-dashboard-hero-qr-canvas` 缩小并降低圆角，形成紧凑二维码容器。
  - `passport-dashboard-hero-qr-code-line span` 调整为 `var(--cp-title-md)`，对齐“成就时间线”字号。
  - `passport-dashboard-hero-qr-status` 与 `passport-dashboard-hero-qr-help` 统一为 `11px`，对齐左侧“积分”标签字号。
  - 移动端断点同步限制二维码卡片最大宽度为 `172px`，确保小屏一致表现。

3. 结果预期
- 二维码区域显著收缩，视觉层级更紧凑。
- 文案字号关系符合页面既有信息层级规范。
