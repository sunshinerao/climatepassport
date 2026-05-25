# BUGFIX_CERTIFICATE_NUMBER_LOST_ON_LOCALE_SWITCH_20260525

## 需求解读
- 在证书签发页面编辑已签发证书时，切换语言后，证书编号不应退回为 `CV-{AUTO-GENERATED}` 占位值。
- 语言切换后的恢复应保持完整编辑态，包括正在编辑的证书上下文和其原始证书编号。

## 修改方法
- 检查证书签发表单的语言切换草稿恢复链路。
- 将编辑态所需的 `editingIssueId` 与 `editingCertificateNumber` 一并纳入草稿持久化与恢复。
- 保持现有“仅语言切换时保留草稿”的行为不变，不扩大到普通页面离开场景。

## 修改内容
- 修改 `apps/passport-web/components/certificate-admin-prototype.tsx`：
  - 扩展 `CertificateIssueDraft`，新增 `editingIssueId` 和 `editingCertificateNumber`。
  - 在草稿恢复时恢复这两个编辑态字段。
  - 在草稿写入 `sessionStorage` 时同步保存这两个字段。
- 修复结果：编辑已签发证书后切换语言，证书编号会继续显示原编号，而不是回退到 `CV-{AUTO-GENERATED}`。
