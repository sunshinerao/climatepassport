# BUGFIX_CERTIFICATE_ISSUE_EDIT_PREFILL_AND_DOWNLOAD_PREVIEW_20260524

## 需求解读
- 在证书签发页中，点击最近签发记录的“编辑”时，上方基础字段会回填，但模板 JSON 定义变量未回填。
- 点击“下载（预览/打印）”时会打开新窗口但无内容，期望改为类似“预览证书”的弹窗内可视预览，以支持打印和下载。

## 修改方法
- 为 `certificate_issues` 增加变量值持久化字段，签发/重签发时将合并后的 `variableValues` 写入数据库。
- 最近签发记录查询时把该变量值字段传到前端，编辑回填时优先用“已签发变量值”回填模板变量输入区。
- 下载按钮改为优先解析证书 HTML data URL，并复用签发页现有预览弹窗展示证书内容；若不是 HTML data URL 再降级到新窗口打开。

## 修改内容
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateAdminIssue` 类型新增 `issueVariableValues`。
  - 新增签发变量回填归一化逻辑，用于编辑模式回填模板变量。
  - 下载逻辑改为：data URL 解析成 HTML 后在预览弹窗显示；不再默认直接打开空白新窗口。
  - 预览弹窗标题改为可动态显示当前证书信息（证书名/编号）。

- 更新 `apps/passport-web/app/[locale]/admin/certificates/issue/page.tsx`
  - 最近签发记录映射新增 `issueVariableValues`，从 `issue.variableValuesJson` 透传。

- 更新 `apps/passport-web/app/api/admin/certificates/issue/route.ts`
  - 签发/重签发写库数据新增 `variableValuesJson: variableValues`。

- 更新 `prisma/schema.prisma`
  - `CertificateIssue` 模型新增 `variableValuesJson Json?` 字段。

- 新增迁移 `prisma/migrations/20260524141000_certificate_issue_variable_values/migration.sql`
  - 为 `certificate_issues` 表新增 `variableValuesJson` JSONB 列。

- 新增脚本 `scripts/backfill-certificate-issue-variable-values.mjs`
  - 用于一次性回填历史 `ISSUED` 证书的 `variableValuesJson`，让旧记录也支持“编辑回填变量”。
  - 支持 `--dry-run` 预检。

## 执行记录
- 已执行数据库字段变更 SQL：
  - `npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260524141000_certificate_issue_variable_values/migration.sql`
- 已执行 Prisma Client 更新：
  - `npx prisma generate`
- 已执行历史数据回填：
  - `node scripts/backfill-certificate-issue-variable-values.mjs`
  - 回填结果：`Updated 2 records.`
