# BUGFIX_CERTIFICATE_PREVIEW_MODAL_QR_VERIFICATION_20260524

## 需求解读
- 预览窗口需要更完整展示证书，避免内容被裁切。
- 预览窗口顶部留白过大，需要压缩无效空白区域。
- 预览二维码必须在预览时真实生成并可扫码。
- 扫描预览二维码时应明确提示“这是预览证书”，避免与正式签发结果混淆。

## 修改方法
- 从三层同时收敛：弹窗容器布局、证书 HTML 预览渲染策略、验证入口语义。
- 弹窗层通过网格行定义和高度策略提升可视区域。
- 渲染层在 iframe 场景增加自动缩放脚本，使证书按可用视口等比适配。
- 预览接口生成绝对验证链接与真实二维码 SVG，并打上 preview 标记。
- 公共验证页面和验证 API 识别 preview 标记，返回预览语义提示。

## 修改内容
- 调整预览弹窗样式：
  - `cpca-preview-modal-dialog` 增加 `grid-template-rows: auto 1fr`，修复头部被拉伸造成的大面积空白。
  - 提升弹窗可用高度、降低 body padding、提高 frame 最小高度。
  - 移动端同步收敛高度与最小 frame 高度。
- 调整证书渲染 HTML：
  - 在嵌入式（iframe）预览时执行 `fitCertificateForEmbeddedPreview`，根据视口宽高对证书做等比缩放并减少上方空白。
  - 打印媒体下强制恢复 `transform: none`，确保导出/打印尺寸不受预览缩放影响。
- 调整模板预览接口：
  - 使用绝对链接 `/verify/certificate/CV-PREVIEW?preview=1` 作为预览验证地址。
  - 通过 `buildCertificateVerificationQrSvg` 生成真实二维码并传入 `renderCertificateHtml`。
- 调整验证体验：
  - 公开验证页新增 preview 分支，展示“预览证书二维码”提示。
  - 验证组件新增 `preview` 状态与对应视觉样式。
  - 公共验证 API 对 preview 请求返回 `PREVIEW` 结果和说明文案。
