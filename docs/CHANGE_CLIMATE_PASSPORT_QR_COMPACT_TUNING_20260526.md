# CHANGE_CLIMATE_PASSPORT_QR_COMPACT_TUNING_20260526

## 需求解读

用户提出 4 个连续微调要求：

1. 二维码区域容器宽度缩小 20%，高度减少 10%。
2. 上方文字距离容器边缘增大 10%。
3. 去掉“全场通用”。
4. 二维码与下方文字间隙，保持与二维码与上方文字间隙一致。

## 修改方法

1. 以当前二维码容器 `340px` 为基准，将宽度调整为 `272px`（缩小 20%）。
2. 通过减小内部垂直间距（meta gap、上下间距）来压缩容器高度表现，并增加顶部内边距保证上方文字离边更远。
3. 在组件中删除“全场通用”节点，并同步清理无用样式。
4. 统一二维码上下间隔值，保证视觉一致。

## 修改内容

1. 组件变更
- 文件：`apps/passport-web/components/platform-screens.tsx`
- 删除二维码区域中的“全场通用”文案节点。

2. 样式变更
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 关键调整：
  - `.passport-dashboard-hero-qr-frame`
    - `width: 340px -> 272px`
    - `padding: 12px 12px 10px -> 14px 12px 8px`
  - `.passport-dashboard-hero-qr-meta`
    - `gap: 6px -> 4px`
  - `.passport-dashboard-hero-qr-canvas`
    - `margin-top: 8px -> 6px`
    - `width: 276px -> 100%`
  - `.passport-dashboard-hero-qr-help`
    - `margin-top: 8px -> 6px`
  - 删除 `.passport-dashboard-hero-qr-status` 样式块。
  - 删除字体统一规则中对 `.passport-dashboard-hero-qr-status` 的引用。
  - 移动端 `max-width: 340px -> 272px`，并同步 padding。

3. 预期效果
- 容器横向更紧凑，纵向高度进一步压缩。
- 顶部文字离容器边缘更远。
- “全场通用”不再显示。
- 二维码上下间隔保持一致。