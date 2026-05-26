# CHANGE_CLIMATE_PASSPORT_QR_HELP_TEXT_UPDATE_20260526

## 需求解读

用户要求将 Climate Passport 页面二维码区域最下方说明文字替换为指定中文文案：

二维码用于验证Climate Passport的信息和状态。同时也是参与行动的通行证。

## 修改方法

1. 仅修改二维码说明文案，不调整布局、字号、间距和其它样式。
2. 在现有多语言逻辑中仅替换中文分支文本，英文分支保持原样。

## 修改内容

1. 组件修改
- 文件：`apps/passport-web/components/platform-screens.tsx`
- 位置：`passport-dashboard-hero-qr-help` 文案渲染处
- 变更：
  - 中文文案替换为：
    - `二维码用于验证Climate Passport的信息和状态。同时也是参与行动的通行证。`

2. 影响范围
- 仅影响中文语言环境下 Climate Passport 页面二维码说明文案。
- 不影响其它页面与功能逻辑。