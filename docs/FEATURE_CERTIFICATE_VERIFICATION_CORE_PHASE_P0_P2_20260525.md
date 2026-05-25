# FEATURE_CERTIFICATE_VERIFICATION_CORE_PHASE_P0_P2_20260525

## 需求解读

- 本次需要直接完成证书验证能力的 1/2/3 阶段改造，不分批确认：
  - 统一验证核心逻辑，避免页面与 API 分叉。
  - 引入策略校验与权限边界，保证未来可作为 Core 能力供壳应用调用。
  - 增加风控与审计基础数据沉淀。
- 新增两项明确要求：
  1. 扫码后展示内容需根据“是否登录 + 身份角色”分级（本次先落证书模块）。
  2. 扫码验证与网站查询都要记录查询次数等信息。

## 修改方法

- 采用“服务层收口”方案：新增统一证书验证服务 `resolvePublicCertificateVerification`，由 API 与页面共同调用。
- 在统一服务中实现：
  - 访问分级（PUBLIC / HOLDER / STAFF）；
  - 策略判断（`verificationMode` 与 `category.publicVerifyEnabled`）；
  - 全量查询日志记录（命中、未命中、预览、策略阻断）；
  - 命中时写入 `certificate_verifications`，并补充 `core_audit_logs` 查询事件。
- 页面层只负责渲染，不再自行查库判定，确保壳应用接入时只需调用同一 Core 逻辑。

## 修改内容

1. 新增统一验证核心服务
- 新增文件：`apps/passport-web/lib/server/certificate-verification.ts`
- 关键能力：
  - 验证码归一化（trim + uppercase）。
  - 身份分级：`PUBLIC`、`HOLDER`、`STAFF`。
  - 策略校验：`INTERNAL_ONLY` 与分类 `publicVerifyEnabled`。
  - 结果统一：`PREVIEW / NOT_FOUND / VALID / REVOKED / INVALID`。
  - 全量查询写审计日志：`certificate.verify.query`。
  - 命中写 `certificate_verifications` 并回传可扩展统计字段（验证次数、查询次数）。

2. 验证 API 收口到核心服务
- 修改：`apps/passport-web/app/api/certificates/verify/[code]/route.ts`
- 变更点：
  - 由原先“路由内直接查库判定”改为调用统一服务。
  - 注入当前用户身份与请求审计上下文。
  - 支持 `source=qr` 查询来源标记，为扫码与网页查询留出区分能力。

3. 公共验证页面收口到核心服务
- 修改：`apps/passport-web/app/verify/certificate/[code]/page.tsx`
- 变更点：
  - 页面由直查数据库改为调用统一服务。
  - 页面访问同样落查询日志。
  - 页面根据统一结果映射状态并渲染身份分级字段。

4. 验证展示组件支持分级与计数信息
- 修改：`apps/passport-web/components/certificate-verify-prototype.tsx`
- 变更点：
  - 扩展状态：新增 `invalid`。
  - 扩展展示数据：访问级别、是否登录、验证次数、查询次数、内部状态、验证模式、分类公开验证开关。
  - 登录用户显示“登录视图信息”，管理员/运维角色可见扩展字段。

5. 审计上下文能力增强
- 修改：`apps/passport-web/lib/server/audit.ts`
- 变更点：
  - 新增 `getHeaderAuditContext(headers)`，支持页面侧（Server Component）取审计上下文。
  - `getRequestAuditContext` 复用该能力。

6. 回归验证
- 执行：`npm test -- tests/certificate-verification-serialization.test.mjs`
- 结果：`35 passed, 0 failed`。
