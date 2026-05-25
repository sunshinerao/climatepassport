# BUGFIX: 法语/德语语言能力落地（2026-05-25）

## 需求解读

- 用户要求把 `fr/de` 从仅显示选项，升级为可用语言入口。
- 目标是让法语/德语访问时返回对应词典，而不是统一回退英文。
- 保持最小范围修改，不改变现有路由和业务流程。

## 修改方法

- 保留现有 `en/zh` 主词典结构不拆分。
- 在 `site-content.ts` 增加 `fr/de` 词典构造函数，基于英文词典生成，并覆盖核心界面文本（导航、按钮、首页关键文案、认证入口文案、信息页标题）。
- 调整 `getDictionary`，对 `fr/de` 返回对应词典对象。
- 保持 `toCoreLocale` 逻辑不变，继续用于账号快照等 `en/zh` 分支。

## 修改内容

- 修改文件：`apps/passport-web/lib/site-content.ts`
- 具体内容：
  - 新增 `buildFrDictionary` 与 `buildDeDictionary`。
  - 新增 `localizedDictionaries: Record<Locale, SiteDictionary>`，聚合 `en/zh/fr/de`。
  - `getDictionary` 从“`fr/de` 回退英文”改为“按 locale 返回对应字典”。
  - 覆盖了法语/德语下的核心界面文案（导航、操作按钮、首页关键 CTA 与认证入口标签、信息页标题）。
