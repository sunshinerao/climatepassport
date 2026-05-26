# CHANGE_CLIMATE_PASSPORT_QR_REMOVE_FRAME_AND_SHRINK_20260526

## 需求解读

用户要求继续优化二维码视觉：

1. 取消二维码周围的框线。
2. 取消二维码周围的衬底效果。
3. 在当前尺寸基础上，二维码本体再缩小 30%。

## 修改方法

1. 在二维码画布容器层移除边框、背景和内边距，使二维码直接呈现。
2. 按“当前 70% 再缩小 30%”计算二维码最终比例：`0.7 * 0.7 = 0.49`。
3. 将二维码图片宽度比例调整为 `49%`。

## 修改内容

1. 样式文件修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 变更：
  - `.passport-dashboard-hero-qr-canvas`
    - `border-radius: 0`
    - `border: 0`
    - `background: transparent`
    - `padding: 0`
  - `.passport-dashboard-hero-qr-image`
    - `width: 70%` -> `width: 49%`

2. 结果预期
- 二维码周围不再有额外框线或衬底。
- 二维码本体进一步缩小，视觉更简洁。