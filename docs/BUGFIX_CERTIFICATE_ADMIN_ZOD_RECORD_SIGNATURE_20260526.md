# 需求解读
CI / 本地构建在处理证书后台的请求 schema 时失败，报错指向 `z.record(...)` 的参数签名不兼容。需要修复成当前 Zod 版本可接受的写法，保证构建通过。

# 修改方法
检查所有使用 `z.record` 的后台接口 schema，按 Zod v4 的签名显式提供 key schema 与 value schema，避免类型推断落到旧版单参数形式。

# 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 文件：[apps/passport-web/app/api/admin/certificates/templates/preview/route.ts](apps/passport-web/app/api/admin/certificates/templates/preview/route.ts)
- 将 `variableValues: z.record(z.unknown()).optional()` 改为 `variableValues: z.record(z.string(), z.unknown()).optional()`。
- 修复目标是让证书签发与模板预览两个接口在当前 Zod 版本下正常编译。

# 本次追加（证书签发 Prisma 空值收紧）

## 需求解读
Zod 签名修复后，构建继续暴露证书签发接口中的类型告警：`prisma` 在事务闭包内仍被推断为可能为空。需要把它收紧成确定非空的局部引用。

## 修改方法
在通过 `getPrismaClient()` 非空检查后，立即复制成局部 `prismaClient`，并在闭包中只使用这个非空引用，避免 TypeScript 处理闭包时保留空值分支。

## 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 新增局部变量 `const prismaClient = prisma;`。
- 将事务调用从 `prisma.$transaction(...)` 改为 `prismaClient.$transaction(...)`。
- 目标是清除 `prisma is possibly null` 的构建错误。

# 本次追加（证书签发 issueDate 空值收紧）

## 需求解读
构建继续在证书签发事务闭包里暴露 `issuedAt` 可空告警。需要把已经验证过的日期值收紧为非空常量，再传入事务内部使用。

## 修改方法
在 `issueDate` 校验通过后，立即复制为局部 `issuedAtValue`，并在事务闭包中仅使用这个非空值。

## 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 新增局部变量 `const issuedAtValue = issuedAt;`。
- 将 `buildIssuedCertificateVariableValues` 的 `issueDate` 参数改为 `issuedAtValue`。
- 目标是消除 `Type 'Date | null' is not assignable to type 'Date'` 的构建错误。

# 本次追加（证书签发 admin 用户空值收紧）

## 需求解读
构建继续在证书签发事务闭包里提示 `admin` 可能为空。需要把已经通过权限校验的当前管理员收紧成非空引用再使用。

## 修改方法
在权限校验通过后立即复制为局部 `adminUser`，并在事务闭包中使用这个非空值。

## 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 新增局部变量 `const adminUser = admin;`。
- 将 `signer` 的回退值从 `admin.name` 改为 `adminUser.name`。
- 目标是消除 `Type 'admin' is possibly 'null'` 的构建错误。

# 本次追加（证书签发 issueDate 残留替换）

## 需求解读
构建仍在证书生成的另一处调用里使用了原始可空的 `issuedAt`。需要把所有事务闭包中的日期参数统一替换为非空常量。

## 修改方法
将证书 artifact 构建调用里的 `issueDate` 也改成 `issuedAtValue`，避免任何闭包内部还引用原始可空变量。

## 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 将 `buildCertificateArtifactWithQr` 的 `issueDate` 参数从 `issuedAt` 改为 `issuedAtValue`。
- 目标是消除同文件内残留的 `Type 'Date | null' is not assignable to type 'Date'` 构建错误。

# 本次追加（证书签发闭包剩余引用收紧）

## 需求解读
构建还会继续追踪事务闭包中的 `definition` 与 `admin` / `issuedAt` 残留引用。需要把这些剩余引用统一切换为已验证的非空局部变量。

## 修改方法
在 artifact 构建、issue 写入和审计日志中都只使用 `certificateDefinition`、`adminUser` 和 `issuedAtValue`。

## 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 将 `renderConfigJson`、`definitionId`、`approvedBy`、`approvedAt`、`issuedAt`、`actorUserId` 等闭包内字段统一改为非空局部变量。
- 目标是一次性清除同文件中所有由闭包保留引发的空值类型告警。

# 本次追加（证书签发审计日志元数据收紧）

## 需求解读
构建最后在审计日志元数据里还保留了 `definition` 的旧引用。需要把这处残留也切换到非空别名。

## 修改方法
将审计日志 `metadataJson.definitionId` 改为 `certificateDefinition.id`。

## 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 将 `metadataJson.definitionId` 从 `definition.id` 改为 `certificateDefinition.id`。
- 目标是彻底清除证书签发接口里的 `definition` 闭包空值告警。

# 本次追加（证书签发 editIssueId 规范化）

## 需求解读
构建最后在单个收件人分支里提示 `editIssueId` 仍然可能携带 `null`。需要在进入 helper 之前统一转成 `undefined`。

## 修改方法
新增局部变量 `editIssueIdValue = editIssueId ?? undefined`，并在单收件人分支中传递该值。

## 修改内容
- 文件：[apps/passport-web/app/api/admin/certificates/issue/route.ts](apps/passport-web/app/api/admin/certificates/issue/route.ts)
- 新增 `const editIssueIdValue = editIssueId ?? undefined;`。
- 将 `issueToRecipient(recipientEmails[0], editIssueId)` 改为 `issueToRecipient(recipientEmails[0]!, editIssueIdValue)`。
- 目标是消除 `Type 'string | null | undefined' is not assignable to type 'string | undefined'` 的构建错误。
