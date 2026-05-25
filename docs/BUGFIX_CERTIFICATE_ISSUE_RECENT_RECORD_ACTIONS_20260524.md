# BUGFIX_CERTIFICATE_ISSUE_RECENT_RECORD_ACTIONS_20260524

## 需求解读
- 在证书签发页点击“确认签发”后，需要即时刷新“最近签发记录”。
- 最近签发记录需要显示证书编号，并补齐操作能力：编辑、预览、下载、撤回、删除。
- 证书编号格式中出现了两个连字符（如 `CV-...-...`），需要修复为仅保留前缀连字符。

## 修改方法
- 在签发页前端补齐签发成功后的 `router.refresh()`，确保服务端最新签发数据回流到列表。
- 扩展最近签发记录表格结构，新增证书编号列与操作列，并接入对应 API。
- 新增后台删除证书 API（管理员权限），用于列表“删除”按钮。
- 调整证书编号生成函数，过滤 `base64url` 产生的 `_` 与 `-` 字符，确保编号主体为纯大写字母数字。

## 修改内容
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateAdminIssue` 中单个签发和批量签发成功后执行 `router.refresh()`。
  - 最近签发记录由简表改为完整表：证书编号、持有人、证书、日期、状态、操作。
  - 新增五个操作：
    - 编辑：跳转到证书详情页。
    - 预览：打开证书已生成文件。
    - 下载：调用下载接口后打开下载地址。
    - 撤回：调用后台撤回接口。
    - 删除：调用后台删除接口并确认。
- 更新 `apps/passport-web/app/[locale]/admin/certificates/issue/page.tsx`
  - 最近签发记录数据映射新增 `generatedFileUrl` 与 `generatedFileName`，支撑预览与下载操作。
- 新增 `apps/passport-web/app/api/admin/certificates/[id]/route.ts`
  - 实现管理员删除证书记录接口 `DELETE`。
  - 删除后写入审计日志 `certificate.delete`。
- 更新 `packages/passport-core/src/qr-token.ts`
  - `createCertificateVerificationCode` 仅保留 `[0-9A-Z]` 字符，避免编号主体出现额外连字符。
- 更新 `tests/passport-id.test.mjs`
  - 证书编号正则断言改为 `^CV-[0-9A-Z]+$`。
