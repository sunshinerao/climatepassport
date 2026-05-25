# BUGFIX_CERTIFICATE_ISSUE_EDIT_AND_DOWNLOAD_MERGE_20260524

## 需求解读
- 最近签发记录中的“预览”和“下载”需要合并为一个“下载”入口，点击后可直接打开证书页面，实现预览、打印与下载。
- 最近签发记录中的“编辑”不应跳转到其他页面，而应回填到当前签发页上方编辑区，支持修改后再次签发。
- 再次签发时不能被“重复签发”规则误拦截，需要在后台提供“编辑重签发”能力。

## 修改方法
- 前端在签发页将“下载”行为统一为打开证书产物（已有产物直接打开，否则走下载接口返回地址后打开），移除单独“预览”按钮。
- 前端将“编辑”改为回填上方“单个签发”表单：自动切换到单个签发、回填模板/邮箱/关键变量，并进入“编辑重签发”模式。
- 后端签发接口新增 `editIssueId` 入参：
  - 编辑模式下复用原证书记录并更新产物。
  - 保留或复用原验证码，避免链接无谓变更。
  - 重复签发校验时排除当前编辑记录，避免误判冲突。

## 修改内容
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 最近签发记录中移除独立“预览”按钮，保留并强化“下载（预览/打印）”按钮。
  - 新增 `editingIssueId` 状态与 `editIssuedCertificate(...)` 回填逻辑。
  - 点击“编辑”后回填到上方表单，按钮文案切换为“确认修改并重新签发”。
  - 重新签发成功提示改为“已重新签发”。

- 更新 `apps/passport-web/app/[locale]/admin/certificates/issue/page.tsx`
  - 最近签发记录映射新增 `templateId`，用于“编辑回填”时恢复对应模板。

- 更新 `apps/passport-web/app/api/admin/certificates/issue/route.ts`
  - 请求体 schema 新增 `editIssueId`。
  - 新增编辑重签发路径：若提供 `editIssueId`，更新原 `certificateIssue` 记录而非新建。
  - 重复签发检查在编辑模式下排除当前记录。
  - 审计动作区分 `certificate.issue` 与 `certificate.reissue`。
