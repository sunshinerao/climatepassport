# CHANGE_CLIMATE_PASSPORT_ACHIEVEMENT_BADGE_ENTRANCE_20260526

## 需求解读

用户反馈在 Climate Passport 页面内找不到进入“成就/徽章”的入口。目标是在不恢复独立菜单挂载的前提下，提供清晰、可点击、可回跳的入口，并保持能力在同页实现。

## 修改方法

1. 在 Climate Passport 页面中为“成就时间线”和“徽章墙”增加显式入口链接。
2. 入口采用页内锚点跳转（`#achievement-timeline`、`#badge-wall`），确保仍在同一页面内完成访问。
3. 在“快捷操作”区域补充同样入口，提升可发现性。

## 修改内容

1. 页面入口增强
- 文件：`apps/passport-web/components/platform-screens.tsx`
- 修改点：
  - 成就时间线卡片头部新增“进入徽章墙”入口。
  - 徽章墙卡片头部新增“进入成就时间线”入口。
  - 快捷操作新增：
    - 进入成就时间线
    - 进入徽章墙
  - 成就时间线与徽章墙增加锚点 id：
    - `achievement-timeline`
    - `badge-wall`

2. 验证结果
- 构建验证：`npm run build` 通过（仅有既存无关 hook warning）。
- 浏览器验证：
  - 在 `/zh/dashboard/climate-passport` 可见新入口。
  - 点击“进入徽章墙”后 URL 变为 `#badge-wall`。
  - 点击“进入成就时间线”后 URL 变为 `#achievement-timeline`。
