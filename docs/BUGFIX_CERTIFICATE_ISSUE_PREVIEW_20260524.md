# Certificate Issue Preview Bugfix (2026-05-24)

## 需求解读
- 用户反馈“签发证书功能中，预览证书无效”。
- 期望在签发页面点击“预览证书”时，能够基于当前选中的模板实时展示可视化预览，而不是无响应。

## 修改方法
- 在签发页面前端组件中补齐预览按钮交互逻辑。
- 复用已有模板预览 API (`/api/admin/certificates/templates/preview`) 生成预览 HTML。
- 使用弹窗 + iframe 呈现预览结果，并补充加载态、错误态和 Esc 关闭行为。

## 修改内容
1. 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
- 在 `CertificateAdminIssue` 中新增预览状态：
  - `previewOpen`
  - `previewHtml`
  - `previewError`
  - `previewLoading`
- 增加 `previewCertificate` 方法：
  - 校验是否已选模板。
  - 调用 `/api/admin/certificates/templates/preview`。
  - 处理 JSON / 非 JSON 错误响应。
- 将“预览证书”按钮接入 `onClick`，未选模板时给出明确提示。
- 增加预览弹窗渲染（复用现有样式类），并支持 Esc 与遮罩关闭。
