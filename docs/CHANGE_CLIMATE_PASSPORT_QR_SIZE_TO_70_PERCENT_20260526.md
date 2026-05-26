# CHANGE_CLIMATE_PASSPORT_QR_SIZE_TO_70_PERCENT_20260526

## 需求解读

用户要求将二维码图像缩小到当前尺寸的 70%，并保持二维码卡片容器大小不变。

## 修改方法

1. 仅调整二维码图片元素的宽度比例。
2. 不修改二维码卡片容器宽高、内边距与布局参数。

## 修改内容

1. 样式修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 变更：
  - `.passport-dashboard-hero-qr-image` 宽度由 `100%` 改为 `70%`。

2. 结果预期
- 二维码图像缩小至当前视觉尺寸的约 70%。
- 卡片尺寸和整体版式保持不变。