# FEATURE_CERTIFICATE_VERIFICATION_MULTILINGUAL_ROUTE_WIRING_20260525

## 需求解读

- 用户要求直接推进“公开证书验证页的多语言路由与文案接通”。
- 现状问题：
  - 公开验证页面只存在 `/verify/certificate/[code]`，并固定以英文 `locale="en"` 渲染；
  - 页面中的“验证其他证书”表单提交到 `/{locale}/verify`，但该路由并不存在。
- 目标：
  - 支持 `/{locale}/verify/certificate/[code]`（`en/zh/fr/de`）直接渲染并使用对应语言文案；
  - 兼容历史无语言前缀链接，不中断既有二维码验证入口。

## 修改方法

- 新增 locale 版公开验证页面路由，将原有验证逻辑迁入该路由，并按 `params.locale` 驱动文案与日期格式。
- 旧的无前缀路由改为“兼容重定向层”，统一跳转到 `/en/verify/certificate/[code]`，保留 `preview/source` 查询参数。
- 补齐 `verify` 查询入口路由：
  - `/{locale}/verify?code=...` -> `/{locale}/verify/certificate/[code]`
  - `/verify?code=...` -> `/en/verify/certificate/[code]`
- 对服务返回的固定英文提示做页面层本地化映射（当前覆盖中文），使结果提示与页面文案语言一致。

## 修改内容

- 修改 `apps/passport-web/app/verify/certificate/[code]/page.tsx`
  - 从“固定英文渲染页”改为“兼容重定向页”。
  - 保留并转发 `preview/source` 查询参数。

- 新增 `apps/passport-web/app/[locale]/verify/certificate/[code]/page.tsx`
  - 接入现有 `resolvePublicCertificateVerification` 服务。
  - `CertificateVerifyPage` 改为使用动态 `locale`。
  - 日期格式改为 `formatCertificateDate(params.locale, ...)`。
  - 新增服务消息本地化映射函数，先覆盖中文常见提示。

- 新增 `apps/passport-web/app/[locale]/verify/page.tsx`
  - 支持从 `/{locale}/verify?code=...` 跳转到 `/{locale}/verify/certificate/[code]`。

- 新增 `apps/passport-web/app/verify/page.tsx`
  - 支持从 `/verify?code=...` 跳转到 `/en/verify/certificate/[code]`。

- 路由效果
  - 新入口：`/en/verify/certificate/:code`、`/zh/verify/certificate/:code`、`/fr/verify/certificate/:code`、`/de/verify/certificate/:code`
  - 兼容入口：`/verify/certificate/:code`（重定向到 `/en/...`）
  - 表单入口：`/{locale}/verify?code=...`、`/verify?code=...`