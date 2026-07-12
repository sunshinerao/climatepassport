# Identity Boundary Disclosure Changes (2026-07-12)

## 需求解读

本次变更目标是在容易产生身份误解的公开页面中增加明确边界声明，说明 Climate Passport 不是政府签发的身份证明、国家身份凭证或旅行证件。该声明有助于降低用户、机构、搜索引擎和 AI crawler 将 Climate Passport ID 或 Passport 概念误解为法定身份或旅行文件的风险。

## 修改方法

1. 将边界声明加入 about Entity Definition Page，作为独立的 “Identity boundary / 身份边界” 维度。
2. 将边界声明加入 privacy 页面开头说明，明确平台身份与个人信息处理场景的关系。
3. 将边界声明加入 terms 页面，作为使用条款中的平台范围限制。
4. 保持页面布局、路由、权限、metadata 策略和业务逻辑不变。

## 修改内容

- `apps/passport-web/components/about-entity-screen.tsx`
  - 新增英文与中文身份边界声明。
  - 新增 “Identity boundary / 身份边界” section。
- `apps/passport-web/components/privacy-policy-screen.tsx`
  - 在中英文隐私承诺部分加入平台身份边界说明。
- `apps/passport-web/lib/site-content.ts`
  - 在中英文 terms 页面新增身份边界条款卡片。