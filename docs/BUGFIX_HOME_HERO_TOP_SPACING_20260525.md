# BUGFIX: 首页首屏顶部多余留白收敛（2026-05-25）

## 需求解读

- 用户指出主页面第一部分顶部存在多余空白。
- 目标是在不影响其他页面间距的前提下，去掉首页首屏顶部冗余留白。

## 修改方法

- 识别首屏所在页面结构：`HomeScreen` 首段为 `proto-home-hero`，其外层受通用容器 `.page` 的顶部 padding 影响。
- 在 `SiteShell` 基于当前路由识别 locale 首页路径，仅对首页追加 `page-home` 类。
- 在样式中对 `page-home` 覆盖 `padding-top` 为 `0`，其余页面继续使用原有通用间距。

## 修改内容

- 修改文件：`apps/passport-web/components/site-shell.tsx`
  - 新增首页路径识别：`isLocaleHome`。
  - 首页主容器 class 从 `page` 改为 `page page-home`。
- 修改文件：`apps/passport-web/app/globals.css`
  - 新增 `.page-home { padding-top: 0; }`。
