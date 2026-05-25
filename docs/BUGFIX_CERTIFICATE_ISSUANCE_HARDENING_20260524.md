# Certificate Issuance Hardening Bugfix (2026-05-24)

## 需求解读
- 明确业务约束：不允许重复签发（同一用户 + 同一证书定义不能重复发放有效证书）。
- 修复签发链路问题：
  - 学习体验完成自动签发时，存在 `ISSUED` 但无渲染文件的记录，导致下载不可用。
  - 手动签发缺少审计日志，后台追踪链路不完整。
  - 签发前端对异常响应处理不稳健，易误报“网络错误”。

## 修改方法
- 手动签发接口增加重复签发检查，并在成功签发后写入审计日志。
- 学习体验完成自动签发路径补全证书产物生成（HTML 数据文件）并落库，确保 `ISSUED` 即可下载。
- 签发页前端改为按响应类型解析错误，避免非 JSON 响应导致误判网络异常。

## 修改内容
1. 更新 `apps/passport-web/app/api/admin/certificates/issue/route.ts`
- 请求体解析改为容错模式（无效 JSON 返回 400）。
- 新增重复签发拦截：若已存在同用户同定义且未撤销的证书，返回 409。
- 新增签发成功审计日志 `certificate.issue`。

2. 更新 `apps/passport-web/app/api/admin/learning-experiences/applications/[id]/status/route.ts`
- 在学习体验完成自动签发时：
  - 查询定义/模板/分类。
  - 构建变量值并生成证书产物（含二维码）。
  - 创建 `certificateIssue` 时写入 `generatedFileName` 与 `generatedFileUrl`。
- 补充 `programConfigJson` 查询字段，用于提取学习时长与能力标签。

3. 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
- 签发按钮请求结果改为按 `content-type` 解析。
- 对非 JSON 错误响应进行文本回退显示，减少“网络错误”误报。

4. 新增 `tests/certificate-issuance-routes.test.mjs`
- 覆盖“重复签发返回 409”场景，校验后端硬约束生效。
- 覆盖“学习体验 COMPLETED 自动签发时生成文件字段落库”场景，防止 `ISSUED` 记录缺少可下载文件。
