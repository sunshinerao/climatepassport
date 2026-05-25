# BUGFIX_CERTIFICATE_ISSUE_INVALID_INPUT_AND_LOCALE_SWITCH_DRAFT_20260525

## 需求解读
- 点击“确认签发”出现 `Invalid input`，需要修复签发请求参数与后端校验的不一致。
- 点击语言切换器后，签发页已经输入的内容不应消失，需要在语言切换后自动保留并恢复表单输入。

## 修改方法
- 前端签发请求在非编辑模式下不再传递 `editIssueId: null`，避免触发 Zod `uuid` 校验失败。
- 后端签发接口将 `editIssueId` 校验升级为 `nullish`，提升接口容错性。
- 在签发组件中加入 sessionStorage 草稿持久化与恢复逻辑，覆盖单个签发、批量签发与变量输入。
- 模板切换时，变量默认值改为与现有输入合并，避免恢复后的输入被模板默认值覆盖。

## 修改内容
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - `issueCertificate` 请求体改为仅在编辑模式传递 `editIssueId`。
  - 新增签发表单草稿结构与存储 key。
  - 新增“首次恢复草稿”与“状态变化自动保存草稿”两个 effect。
  - 模板变更时变量值从“覆盖”改为“默认值 + 已有值合并”。

- 更新 `apps/passport-web/app/api/admin/certificates/issue/route.ts`
  - `issueSchema.editIssueId` 从 `optional()` 调整为 `nullish()`，避免传入 `null` 时返回 `Invalid input`。
