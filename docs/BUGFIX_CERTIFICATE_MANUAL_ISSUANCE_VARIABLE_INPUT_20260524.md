# Certificate Manual Issuance Variable Input Bugfix (2026-05-24)

## 需求解读
- 手动签发证书不能只依赖其他模块自动传值，还必须支持后台人工签发。
- 手动签发需要覆盖两个场景：
  - 单个签发：选择模板后，能够输入该模板 JSON 中已定义且可见的变量信息，并点击“预览证书”查看最终样式。
  - 批量签发：能够对多个邮箱执行手动批量签发，并复用同一模板与变量输入。
- 预览实现需参考“模板管理”中的预览能力，确保签发前看到的效果与模板渲染一致。

## 修改方法
- 在签发页服务端查询中补齐模板的 `renderConfigJson`、分类信息和有效定义信息，使前端能够基于真实模板 JSON 动态生成变量输入区。
- 在签发页前端组件中：
  - 从模板 `renderConfig.elements` 中提取 `kind = VARIABLE` 且 `visible != false` 的字段。
  - 自动生成手动输入表单。
  - 单个签发复用现有模板预览 API 生成实时预览。
  - 批量签发改为真实邮箱名单输入，而非静态占位表格。
- 在手动签发 API 中扩展支持：
  - `variableValues`
  - `issueDate`
  - `emails`（批量）
- 将手填变量与系统默认变量合并后参与证书渲染，确保预览与最终签发结果一致。

## 修改内容
1. 更新 `apps/passport-web/app/[locale]/admin/certificates/issue/page.tsx`
- 查询活跃模板时增加：
  - 分类名称
  - 有效定义
  - `renderConfigJson`
- 将这些真实模板数据传给 `CertificateAdminIssue`，供前端动态渲染手填变量和预览使用。

2. 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
- 为 `CertificateAdminIssue` 增加模板变量解析逻辑：
  - 从模板 JSON 中识别可见 `VARIABLE` 元素。
  - 自动生成单行输入框或多行输入框（如 `capabilityTags`）。
- 可见变量的内部变量名不再显示在输入框下方，改为与分类页一致的 `i` 提示图标展示，tooltip 内容为模板变量名。
- 将提示图标抽离为可复用组件 `apps/passport-web/components/info-tooltip.tsx`，避免分类页与签发页重复维护同一套 DOM 结构。
- 在此基础上进一步新增 `FieldLabelWithInfo` 组件，统一“字段标题 + 提示图标”的组合写法，作为当前提示功能的默认复用入口。
- 继续新增 `apps/passport-web/components/form-feedback.tsx`，统一表单错误、成功、说明、一般消息的渲染入口，避免继续直接散写 `form-error`、`form-success`、`cpca-muted`、`cpca-message` 类名。
- 单个签发：
  - 增加 `issueDate` 和动态 `variableValues` 状态。
  - 点击“预览证书”时，调用 `/api/admin/certificates/templates/preview`，并传入当前模板与手填变量。
- 批量签发：
  - 增加邮箱文本框（支持换行、逗号、分号分隔）。
  - 支持共享模板变量与统一签发日期。
  - 点击批量签发后调用同一签发 API，显示成功/失败汇总结果。

3. 更新 `apps/passport-web/app/api/admin/certificates/issue/route.ts`
- 请求体从单一 `email + templateId` 扩展为支持：
  - `email`
  - `emails`
  - `issueDate`
  - `variableValues`
- 单个签发：
  - 将手填变量与系统变量合并。
  - 使用合并后的变量值生成证书文件。
- 批量签发：
  - 对每个邮箱逐个签发。
  - 返回 `summary` 与逐条结果，支持部分成功、部分失败。
- 仍保留重复签发拦截与审计日志写入。

4. 更新 `tests/certificate-issuance-routes.test.mjs`
- 新增“手填变量参与证书渲染”回归测试。
- 新增“批量签发返回汇总结果”回归测试。

5. 验证结果
- 执行 `npm test`
- 结果：35 tests passed, 0 failed.
