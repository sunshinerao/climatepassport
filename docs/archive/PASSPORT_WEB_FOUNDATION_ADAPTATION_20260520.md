# Passport Web Foundation Adaptation 2026-05-20

## 需求解读

- 需要认真阅读 `docs/climate-passport-design-foundation.md`，并严格按照该文档将 Climate Passport 页面重新适配。
- 目标不是“主观美化”，而是落地该规范中的硬性要求：颜色体系、字体与字号层级、组件风格、布局留白、页脚语义与可访问性基线。

## 修改方法

- 先将 `climate-passport-design-foundation.md` 中的视觉 token 与组件规则映射到现有 `passport-web` 全局样式体系。
- 保持页面结构和业务逻辑不变，仅重建设计层（CSS token、组件样式、交互状态、响应式规则）。
- 按规范补齐可访问性基础（focus-visible 统一样式）。
- 通过 build 与页面抽查验证改造可运行且无编译回归。

## 修改内容

- 更新 `apps/passport-web/app/globals.css`
  - 颜色体系改为 foundation 指定 palette（`#12382F` / `#17483D` / `#1F5A4E`、`#F6F9F6`、`#EEF6F1`、`#DDE7E1`、`#BFD0C8`）
  - 页面背景改为 foundation 推荐 page gradient（浅色机构化背景）
  - 字体栈、字号、行高变量重建为 foundation 推荐层级
  - 按钮体系改为四类：`primary` / `secondary` / `outline` / `ghost`（保留现有页面主要使用的 `button` 与 `button-secondary`）
  - 卡片样式改为机构化轻边框 + 超轻阴影（`0 14px 36px rgba(18,56,47,0.04)`）
  - Hero / Passport 视觉块改为 foundation 批准的 institutional gradient，并加入低透明度网格覆盖
  - Footer 改为 foundation 指定深色信任层底色（`#0F2F28`）
  - 增加全局 `focus-visible` 样式，满足可访问性基线
  - 调整容器宽度到 `1280px`，并加大 section 间距，匹配“calm and spacious”要求
- 更新 `apps/passport-web/app/layout.tsx`
  - 根字体栈同步为 foundation 推荐多语言栈：Inter + Noto Sans SC + Source Han Sans SC + PingFang SC + system-ui

## 验证

- `npm run build --workspace passport-web`：通过
- 关键页面抽查：`/zh`、`/en/auth/login` 可访问
