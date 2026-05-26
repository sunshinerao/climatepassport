# CHANGE_CLIMATE_PASSPORT_QR_VERTICAL_RELAYOUT_NO_ELLIPSIS_20260526

## 需求解读

用户要求在保持二维码容器尺寸不变的前提下，对内部内容进行自上而下重新排布：

1. 上方文字
2. 中间二维码
3. 下方文字

并要求下方文字不出现省略号，全文展示。

## 修改方法

1. 保持容器宽高参数不改，仅重构容器内部布局为三段式纵向结构。
2. 使用网格布局将中间二维码放在中间层，底部说明文案落在底部层。
3. 去掉说明文案的行截断与溢出隐藏规则，保证完整显示。
4. 同步移动端样式，避免断点下重新出现二维码画布额外内边距。

## 修改内容

1. 样式文件修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 关键变更：
  - `.passport-dashboard-hero-qr-frame`
    - `display: flex` -> `display: grid`
    - 新增 `grid-template-rows: auto 1fr auto`
    - 新增 `row-gap: 8px`
  - `.passport-dashboard-hero-qr-meta`
    - 新增 `align-self: start`
  - `.passport-dashboard-hero-qr-canvas`
    - `margin-top: 0`
    - 新增 `align-self: center`
  - `.passport-dashboard-hero-qr-help`
    - `margin-top: 0`
    - 删除行截断相关规则（`-webkit-line-clamp`、`overflow: hidden` 等）
    - 新增 `align-self: end`
  - 移动端断点：`.passport-dashboard-hero-qr-canvas` 取消额外圆角与内边距，保持与桌面一致排布逻辑。

2. 结果预期
- 保持容器尺寸不变。
- 三段信息层级更清晰（上文案/中二维码/下文案）。
- 下方说明完整显示，不再出现省略号。