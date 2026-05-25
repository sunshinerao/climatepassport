# BUGFIX_CERTIFICATE_ISSUE_EDIT_CERTIFICATE_NUMBER_PREFILL_20260525

## 需求解读
- 在证书签发页面中，编辑一张已经签发的证书时，表单中的证书编号应回填为该证书当前编号，不能继续显示通用占位值。
- 该回填应只影响“编辑已签发证书”的显示与预览，不应把旧编号错误带入新的普通签发流程。

## 修改方法
- 为编辑态新增独立的本地证书编号状态，只在点击“编辑”回填时赋值。
- 单个签发表单中的只读“证书编号”输入框改为优先显示编辑态编号。
- 编辑态预览也优先使用该回填编号，避免预览与表单显示不一致。
- 在取消编辑和重签发成功后清空该编辑态编号，避免污染后续新签发。

## 修改内容
- 修改 `apps/passport-web/components/certificate-admin-prototype.tsx`：
  - 新增 `editingCertificateNumber` 状态。
  - `editIssuedCertificate(...)` 中回填 `issue.certificateNumber`。
  - 单个签发表单的“证书编号”只读输入框改为根据编辑态动态显示。
  - `buildPreviewPayload(...)` 在编辑态下优先使用回填编号。
  - 取消编辑与重签发成功后清空 `editingCertificateNumber`。
