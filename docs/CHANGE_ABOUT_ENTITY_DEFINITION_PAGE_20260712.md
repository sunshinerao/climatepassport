# About Entity Definition Page Changes (2026-07-12)

## 需求解读

本次变更目标是将 Climate Passport 的 about 页面建设为面向搜索引擎、AI crawler 与普通访客都清晰可读的 Entity Definition Page。页面需要适配现有多语言体系，视觉风格保持与 privacy 等长文本公开页面一致，并以 “What is Climate Passport?” 作为标题。

页面必须沿用全网站统一的 Climate Passport 英文与中文标准定义，同时补充多个维度说明，包括 Climate Passport ID、可验证资质、持续成长数字档案以及机构/合作方使用方式。

同时，首页中不标准或过强的信任表达需要替换为更稳健的社区连接与可验证资质表述。

## 修改方法

1. 保留现有 `/[locale]/about` 路由、metadata 与 AboutPage JSON-LD 注入方式不变。
2. 新增专用 `AboutEntityScreen` 组件，复用 privacy 页面使用的 section、panel、list 样式，避免新增视觉体系。
3. 为英文与中文分别提供结构化的实体定义内容；法语、德语页面暂使用英文实体定义，保持机器可读的一致性。
4. 替换首页 hero badge 与 credentials feature card 中不标准的信任表达。
5. 将 about 页面源字典标题同步为 “What is Climate Passport?”，使页面 metadata 与 AboutPage JSON-LD name 保持一致。

## 修改内容

- `apps/passport-web/app/[locale]/about/page.tsx`
  - 将 about 页面主体从通用 `InfoScreen` 切换为 `AboutEntityScreen`。
- `apps/passport-web/components/about-entity-screen.tsx`
  - 新增多语言 Entity Definition Page 内容。
  - 页面标题为 “What is Climate Passport?”。
  - 覆盖实体定义、Climate Passport ID、可验证资质、持续成长档案、机构与合作方使用方式。
- `apps/passport-web/components/platform-screens.tsx`
  - 首页 badge 从 “Trusted by 10,000+ climate champions” 更新为 “Connected to a growing global climate community”。
  - 首页 credentials feature 说明更新为更标准的 verifiable credentials / portable / shareable / verification 表达。
- `apps/passport-web/lib/site-content.ts`
  - 将英文和中文 about 页面标题源统一为 “What is Climate Passport?”。