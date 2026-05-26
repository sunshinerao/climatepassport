# Bugfix: Certificate Issuance "签发失败" Error

**Commit**: `ae685c3`  
**Date**: 2026-05-24

---

## 需求解读

证书签发页面点击"确认签发"后，提示"签发失败"（泛型回退错误）。实际上服务端返回了非 JSON 的 500 错误，客户端无法解析 `result.error`，只能回退到"签发失败"字符串。

---

## 修改方法

定位到 `apps/passport-web/app/api/admin/certificates/issue/route.ts`，发现两处结构缺陷：

1. **`writeCoreAuditLog` 在 Prisma 事务回调内调用**：该函数使用全局 `getPrismaClient()`（非事务连接），若审计日志写入失败，异常在事务回调中抛出 → 事务回滚 → 证书未保存，且没有 try/catch 捕获该异常。
2. **`issueToRecipient` 函数调用处无 try/catch**：未捕获的异常传到 Next.js，返回 500 HTML 响应而非 JSON，客户端解析失败，只显示"签发失败"。

修复策略：
- 将整个 `$transaction(...)` 调用包裹在 try/catch 中，捕获异常后返回结构化 `{ ok: false, status: 500, error: "..." }` JSON 响应。
- 将 `writeCoreAuditLog` 移到事务外，作为 fire-and-forget（`.catch(console.error)`），审计日志失败不影响证书签发。
- 修正两处 Prisma 字段 `string | null` 到 `string | undefined` 的类型问题（`?? undefined` / `?? verificationCode`）。

---

## 修改内容

**文件**: `apps/passport-web/app/api/admin/certificates/issue/route.ts`

- 在 `issueToRecipient` 函数内，将 `prismaClient.$transaction(...)` 包裹在 `try/catch` 中：
  - catch 块打印 `console.error("[certificate.issue] transaction failed:", msg)` 并 return `{ ok: false as const, email, status: 500, error: \`Certificate issuance failed: ${msg}\` }`
- 将 `writeCoreAuditLog(...)` 调用从事务回调内部移至事务完成之后，使用 `void ...catch(...)` 模式
- 新增 `TxResult` 联合类型（ok: true 分支 | ok: false 分支）用于事务返回值的类型安全传递
- 修正 `duplicateIssue.verificationCode` 类型不匹配：`string | null` → `string | undefined`（`?? undefined`）
- 修正 `issue.verificationCode` 类型不匹配：`string | null` → `string`（`?? verificationCode`，取已分配的 verificationCode 作为回退）
