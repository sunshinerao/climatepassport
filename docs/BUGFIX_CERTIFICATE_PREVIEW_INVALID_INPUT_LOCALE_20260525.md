# BUGFIX_CERTIFICATE_PREVIEW_INVALID_INPUT_LOCALE_20260525

## 需求解读
- 用户在签发页点击“预览证书”时出现 `Invalid input`。
- 预览接口应兼容系统支持的所有语言路由，不应因为 locale 校验过窄导致请求被拒绝。

## 修改方法
- 检查预览 API 请求体校验 schema，定位到 `locale` 仅允许 `zh/en`。
- 将 `locale` 枚举扩展为系统已支持的 `en/zh/fr/de`。
- 保持原有渲染逻辑不变：中文仍走中文文案，其它语言走英文回退文案。

## 修改内容
- 更新 `apps/passport-web/app/api/admin/certificates/templates/preview/route.ts`
  - `previewPayloadSchema.locale` 从 `z.enum(["zh", "en"])` 调整为 `z.enum(["zh", "en", "fr", "de"])`。
  - 解决在 `fr/de` 路由下点击“预览证书”返回 `Invalid input` 的问题。
