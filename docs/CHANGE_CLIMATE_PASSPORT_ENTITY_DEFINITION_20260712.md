# Climate Passport Entity Definition Standardization (2026-07-12)

## 需求解读

本次变更目标是在所有公开页面和机器可读入口中，用基本一致的语言定义 Climate Passport，避免首页、关于页、隐私页、证书验证页、SEO metadata、JSON-LD 与 `llms.txt` 对平台实体的描述不一致。

标准英文定义为：Climate Passport is an AI-driven trusted digital identity infrastructure for the climate era, designed to turn climate learning, participation, credentials and action into a verifiable, portable and continuously growing digital profile.

标准中文定义为：Climate Passport 是面向气候时代的 AI 驱动可信数字身份基础设施，将个人的气候学习、参与、资质与行动转化为可验证、可携带并持续成长的数字档案。

## 修改方法

1. 将全局 SEO 描述更新为标准英文定义，让 metadata、Open Graph、Twitter metadata、Organization JSON-LD、SoftwareApplication JSON-LD 和 `llms.txt` 共享同一实体定义。
2. 将公开首页与关于页的英文、中文主要定义文案更新为标准定义。
3. 将首页 tooltip、hero 描述、公开页脚、隐私政策开头和证书验证信任说明中的实体定义同步为标准英文/中文表述。
4. 保持页面布局、交互、路由、权限、noindex 策略和业务逻辑不变。

## 修改内容

- `apps/passport-web/lib/seo.ts`
  - 新增 `climatePassportDefinition`，并让 `defaultSeoDescription` 使用标准英文定义。
  - 让 DefinedTermSet 中 Climate Passport 的定义继承标准描述，并同步 credentials/action terms 的关联表述。
- `apps/passport-web/lib/site-content.ts`
  - 更新英文首页 body、英文 about intro 与 What it is 文案。
  - 更新中文首页 body、中文 about intro 与它是什么文案。
- `apps/passport-web/components/platform-screens.tsx`
  - 更新首页 Climate Passport tooltip 和 hero 描述中的实体定义。
- `apps/passport-web/components/privacy-policy-screen.tsx`
  - 更新中英文隐私承诺开头的 Climate Passport 定义。
- `apps/passport-web/components/certificate-verify-prototype.tsx`
  - 更新公开证书验证页信任说明中的 Climate Passport 定义。
- `apps/passport-web/components/site-shell.tsx`
  - 更新公开 shell 页脚 fallback 中的 Climate Passport 定义。