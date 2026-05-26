# CHANGE_CLIMATE_PASSPORT_QR_CONTAINER_80_PERCENT_KEEP_SIZE_20260526

## 需求解读

用户要求继续微调二维码区：

1. 二维码容器宽度缩小到当前的 80%。
2. 二维码本体尺寸保持不变，不随容器缩小。

## 修改方法

1. 以当前容器宽度 `272px` 为基准，按 80% 调整为 `218px`（四舍五入）。
2. 将二维码图片宽度从相对百分比改为固定像素值，锁定视觉尺寸，避免随父容器缩放。
3. 同步更新移动端 `max-width`，保持一致行为。

## 修改内容

1. 样式修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 变更：
  - `.passport-dashboard-hero-qr-frame`
    - `width: 272px -> 218px`
  - `.passport-dashboard-hero-qr-image`
    - `width: 49% -> 133px`（固定当前视觉尺寸）
  - 移动端断点 `.passport-dashboard-hero-qr-frame`
    - `max-width: 272px -> 218px`

2. 结果预期
- 容器更窄（80%）。
- 二维码本体保持原视觉大小，不跟随容器缩小。