# CHANGE_FILE_PICKER_STYLE_UNIFICATION_20260527

## 需求解读

本次需求是统一后台中“选择文件”交互风格，要求对齐“用户信息维护-选择头像”的视觉与交互模式，并且要展示当前已保存图片，避免管理员只能盲传。

具体目标：

1. 所有相关文件上传入口采用同一套按钮样式与文件名反馈。
2. 不能直接暴露原生 file input，需要改为隐藏 input + 自定义按钮触发。
3. 每个上传项都要显示已有图片预览（当前配置值），支持重新上传替换。

## 修改方法

1. 提取并复用“头像上传”模式：
   - 隐藏 input（仅保留可访问性）。
   - 自定义“选择文件”按钮。
   - 显示当前选择文件名（未选择时显示占位文案）。
   - 展示已保存图片预览和说明文案。
2. 在系统管理和证书模板两个模块统一替换原有原生 file input 展示。
3. 在全局样式中新增通用上传样式类，保证多个页面一致。

## 修改内容

1. 系统管理上传入口改造
- 更新：`apps/passport-web/components/admin-system-settings-client.tsx`
- 涉及字段：彩色 Logo、反白 Logo、Favicon。
- 具体变化：
  - 新增隐藏 input 引用（`useRef`）+ 自定义按钮触发。
  - 新增文件名状态（分别显示每个上传项当前文件名）。
  - 保留并增强已保存图片预览展示（显示当前 logo/favicon）。
  - 上传提示文案统一。

2. 证书模板上传入口改造
- 更新：`apps/passport-web/components/admin-certificate-config-forms.tsx`
- 涉及字段：证书背景图、机构 Logo、签名图片、印章图片。
- 具体变化：
  - 4 个上传入口统一改为同款交互（隐藏 input + 自定义按钮 + 文件名显示）。
  - 新增对应文件名状态与 input ref。
  - 每个上传项均显示已有图片预览与替换提示。
  - 编辑不同模板时清空文件名状态，避免误导。

3. 通用样式新增
- 更新：`apps/passport-web/app/globals.css`
- 新增类：
  - `.file-upload-input`
  - `.file-upload-row`
  - `.file-upload-button`
  - `.file-upload-filename`
  - `.file-upload-preview`
  - `.file-upload-preview-image`
  - `.file-upload-meta`
- 风格与“用户信息维护-头像上传”保持一致（渐变按钮、边框、hover 阴影、预览卡片）。
