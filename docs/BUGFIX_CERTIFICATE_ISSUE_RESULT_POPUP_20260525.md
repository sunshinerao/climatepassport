# BUGFIX_CERTIFICATE_ISSUE_RESULT_POPUP_20260525

## 需求解读
- 用户在点击“确认签发证书”后，签发结果（成功或失败）应以弹出形式展示，而不是仅在页面内展示普通消息文本。
- 弹窗应覆盖成功、后端错误、网络错误与前置校验错误等签发链路反馈场景。

## 修改方法
- 在证书签发组件内新增签发结果弹窗状态。
- 将 `issueCertificate()` 里原先 `setMessage(...)` 的结果提示替换为弹窗打开逻辑。
- 复用现有证书预览遮罩层视觉风格，新增紧凑型结果弹窗样式。
- 保持其他功能（预览、撤回、删除、批量签发）的原有消息机制不变，避免扩大影响范围。

## 修改内容
- 修改 `apps/passport-web/components/certificate-admin-prototype.tsx`：
  - 新增 `issueFeedbackOpen / issueFeedbackKind / issueFeedbackMessage` 状态。
  - 新增 `openIssueFeedback(...)` 和 `closeIssueFeedbackModal()`。
  - `issueCertificate()` 改为在校验失败、接口失败、网络异常、签发成功时均使用弹窗反馈。
  - 新增签发结果弹窗 JSX（`role="alertdialog"`），支持关闭按钮和 `Escape` 关闭。
- 修改 `apps/passport-web/app/globals.css`：
  - 新增 `cpca-feedback-modal-dialog` 与 `cpca-feedback-modal-body` 样式。
  - 增加移动端适配样式。
