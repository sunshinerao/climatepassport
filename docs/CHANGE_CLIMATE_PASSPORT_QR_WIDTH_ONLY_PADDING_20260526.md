# CHANGE_CLIMATE_PASSPORT_QR_WIDTH_ONLY_PADDING_20260526

## 需求解读

用户要求继续调整二维码区：

1. 只增加宽度，不调整此前高度表现。
2. 二维码本体大小保持不变。
3. 通过增加四周留白实现更宽松版式。

## 修改方法

1. 仅调整二维码卡片宽度，不改垂直方向间距与高度相关参数。
2. 将二维码画布固定为当前视觉尺寸并居中，避免宽度扩大时二维码随容器放大。
3. 同步更新移动端最大宽度上限，保持响应式一致。

## 修改内容

1. 样式文件修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 变更：
  - `passport-dashboard-hero-qr-frame` 宽度：`300px` -> `340px`
  - `passport-dashboard-hero-qr-canvas` 新增固定宽度：`276px`
  - `passport-dashboard-hero-qr-canvas` 新增 `justify-self: center` 使其在更宽容器中居中
  - 移动端 `max-width`：`300px` -> `340px`

2. 结果预期
- 二维码区域更宽。
- 二维码本体尺寸维持不变。
- 额外宽度转化为左右留白，不引入高度变化。