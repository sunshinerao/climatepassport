# BUGFIX_CERTIFICATE_VERIFICATION_E2E_VALIDATION_20260525

## 需求解读
- 用户要求将“证书验证核心能力改造”形成正式可归档的实测记录，而不是口头结论。
- 验证范围需覆盖：
  - 公开接口与公开页面的可用性；
  - 预览码/不存在码分支；
  - 基于登录身份的访问级别差异（PUBLIC / HOLDER / STAFF）；
  - 扫码与网页查询两类来源的日志记录与计数变化；
  - 相关回归测试结果。
- 输出结果需可追溯，包括样本、验证方法、关键响应和最终结论。

## 修改方法
- 采用“运行态实测 + 数据库计数核验 + 回归测试”三层验证。
- 在本地运行服务上执行真实请求，分别覆盖：
  - 匿名访问；
  - 带会话访问；
  - 预览码与不存在码；
  - `source=qr` 与 `source=web` 两类来源。
- 通过 Prisma 在验证前后读取 `core_audit_logs` 与 `certificate_verifications` 计数，核对是否按请求产生增量。
- 对 HOLDER/STAFF 访问级别差异采用受控方式验证：临时创建测试证书与会话，执行后自动清理，避免污染业务数据。
- 最后执行聚焦回归测试，确认本轮验证未引入回归。

## 修改内容

### 1) 实测环境与样本
- 日期：2026-05-25。
- 服务地址：`http://localhost:3000`。
- 公开验证页面路由：`/verify/certificate/[code]`。
- 公开验证 API 路由：`/api/certificates/verify/[code]`。
- 真实样本证书（公开策略关闭场景）：
  - `verificationCode`: `CV-SHV76QMDQTSP0GHK`
  - `verificationMode`: `PUBLIC_CODE`
  - `categoryPublicVerifyEnabled`: `false`

### 2) 公开接口与页面可用性
- 请求 `GET /verify/certificate/CV-PREVIEW?preview=1` 返回 200（页面可访问）。
- 请求 `GET /api/certificates/verify/CV-SHV76QMDQTSP0GHK?source=qr` 返回 200。
- 请求 `GET /api/certificates/verify/CV-SHV76QMDQTSP0GHK?source=web` 返回 200。

结论：公开验证页面与 API 路由均可用。

### 3) 预览码与不存在码分支
- 预览码：
  - 请求 `GET /api/certificates/verify/CV-PREVIEW?preview=1&source=qr`
  - 结果：`result=PREVIEW`，`httpStatus=200`，返回预览提示文案。
- 不存在码：
  - 请求 `GET /api/certificates/verify/CV-NOTFOUND-<timestamp>?source=web`
  - 结果：`result=NOT_FOUND`，`httpStatus=404`。

结论：PREVIEW/NOT_FOUND 分支行为正确。

### 4) 公开策略拦截与匿名返回
- 对样本码（分类公开验证关闭）执行匿名请求：
  - 返回：`result=INVALID`，`accessLevel=PUBLIC`。
  - 提示：`This credential is not available for public verification.`

结论：`verificationMode/publicVerifyEnabled` 约束已生效，匿名访问被正确限制。

### 5) 身份分级（HOLDER / STAFF）实测
- 使用受控测试数据验证：
  - 临时创建一张 `ISSUED` 状态证书（`CV-TEMP...`）；
  - 为 holder 与 staff 分别创建临时 session；
  - 调用同一 API：`GET /api/certificates/verify/<tempCode>?source=web`。
- 实测结果：
  - HOLDER 会话：`accessLevel=HOLDER`，`valid=true`，包含 `extended`。
  - STAFF 会话：`accessLevel=STAFF`，`valid=true`，包含 `extended`。
  - `recentVerifications.metadataJson` 中可见 `accessLevel`、`querySource`、`publicAllowed`、`requesterRole`。

结论：身份分级返回与验证元数据写入均正常。

### 6) 查询日志与计数核验
- 在一组组合请求（匿名 qr/web、not-found、preview、holder、staff、page）前后比对计数：
  - `queryLogsForIssue` 增量：`+6`
  - `verificationsForIssue` 增量：`+6`
  - `previewLogs` 增量：`+1`
  - `notFoundLogs` 增量：`+1`

结论：扫码与网页查询均会留下可审计记录，计数增长符合请求行为。

### 7) 回归测试结果
- 执行命令：
  - `npm test -- tests/certificate-verification-serialization.test.mjs tests/certificate-artifact.test.mjs`
- 结果：
  - `tests 35`
  - `pass 35`
  - `fail 0`

结论：验证序列化与证书产物相关回归测试全部通过。

### 8) 风险与说明
- 首轮使用的真实持有人样本因账号状态不满足登录态要求，返回 `PUBLIC` 属预期；
  后续已通过受控临时样本完成严格 HOLDER/STAFF 对照验证。
- 实测中创建的临时会话、临时证书、临时验证记录与审计记录均已清理。

## 验收结论
- 本轮“证书验证核心能力”在运行态与数据层已通过正式实测：
  - 公开访问策略可控；
  - 身份分级生效；
  - 查询日志与计数可追踪；
  - 关键回归测试全通过。
- 可作为当前阶段的正式验证记录归档。