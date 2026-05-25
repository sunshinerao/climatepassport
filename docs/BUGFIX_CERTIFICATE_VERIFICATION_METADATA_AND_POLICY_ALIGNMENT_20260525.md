# BUGFIX_CERTIFICATE_VERIFICATION_METADATA_AND_POLICY_ALIGNMENT_20260525

## 需求解读

- 用户要求继续推进证书验证功能，并严格参照既有需求文档落实公开验证行为。
- 现状与文档的主要偏差有三项：
  - 公开验证服务尚未支持 `expired` 结果链路；
  - 公开验证页的签发机构、关联项目/活动等字段没有从真实证书元数据中提取；
  - 匿名访问命中“不可公开验证”策略时，服务仍会返回证书摘要字段，不符合“验证凭证而不是暴露个人”的最小披露原则。
- 同时，Learning Experience 自动签发链路需要把已生成的证书变量一并落库，否则公开验证页无法稳定展示关联来源等元数据。

## 修改方法

- 在统一服务 `resolvePublicCertificateVerification` 中补齐证书元数据解析：
  - 从 `variableValuesJson` 解析签发机构、关联来源、能力标签、可选到期时间；
  - 当存在有效的到期时间且已过期时，返回 `EXPIRED`；
  - 当匿名访问被公开验证策略拦截时，不再返回证书详情，仅返回状态与提示文案。
- 在公开验证页面映射层接通新字段：`expired`、`expiryDate`、`relatedSource`、`competencies`。
- 在 Learning Experience 完成签发时，将已生成的 `variableValuesJson` 写入 `CertificateIssue`，确保后续公开验证可读取真实来源信息。
- 新增聚焦回归测试，覆盖：
  - 元数据派生；
  - `EXPIRED` 结果；
  - 公开策略拦截下的最小披露行为。

## 修改内容

- 修改 `apps/passport-web/lib/server/certificate-verification.ts`
  - 新增 `EXPIRED` 结果类型。
  - 从 `variableValuesJson` 解析：
    - `issuingOrganization`
    - `relatedSource`
    - `competencies`
    - `expiryDate`
  - 被公开策略拦截且访问级别为 `PUBLIC` 时，不再返回 `certificate` 对象。
  - 审计日志结果改为记录真实验证结果小写值，允许区分 `expired`。

- 修改 `apps/passport-web/app/verify/certificate/[code]/page.tsx`
  - 将服务返回的 `EXPIRED` 映射到页面 `expired` 状态。
  - 接通 `expiryDate`、`relatedSource`、`competencies` 字段。

- 修改 `apps/passport-web/components/certificate-verify-prototype.tsx`
  - 补充 `credentialTypeEn` 类型定义。
  - 当服务未返回证书摘要数据时，隐藏摘要卡和登录态详情区，避免公开策略拦截页出现“未命名证书”等误导性占位内容。

- 修改 `apps/passport-web/app/api/admin/learning-experiences/applications/[id]/status/route.ts`
  - 在 Learning Experience 自动签发证书时持久化 `variableValuesJson`，使公开验证链路可以读取程序名称、能力标签等元数据。

- 新增 `tests/certificate-verification-service.test.mjs`
  - 验证证书元数据派生结果；
  - 验证 `expiryDate` 触发的 `EXPIRED` 分支；
  - 验证匿名命中公开策略限制时不会泄露证书详情。