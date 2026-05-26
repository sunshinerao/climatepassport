# CHANGE_CLIMATE_PASSPORT_QR_HEIGHT_ALIGN_WITH_BADGE_TAG_20260526

## 需求解读

用户要求在不改变二维码容器当前宽度的前提下，将容器高度延伸到与左侧“获得徽章”标签底部一致。

## 修改方法

1. 保持二维码容器宽度不变（继续使用当前宽度）。
2. 让右侧二维码列在 Hero 同行内纵向拉伸。
3. 让二维码卡片本体高度占满右侧列，实现底部对齐。

## 修改内容

1. 样式文件修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 变更：
  - `.passport-dashboard-hero-qr`
    - `display: block` -> `display: flex`
    - 新增 `align-self: stretch`
  - `.passport-dashboard-hero-qr-frame`
    - 保持 `width: 218px` 不变
    - 新增 `height: 100%`
    - 新增 `display: flex`
    - 新增 `flex-direction: column`

2. 结果预期
- 二维码容器宽度不变。
- 右侧容器底部与左侧“获得徽章”标签底部对齐。