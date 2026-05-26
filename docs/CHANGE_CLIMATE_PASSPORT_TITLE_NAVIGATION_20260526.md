# CHANGE_CLIMATE_PASSPORT_TITLE_NAVIGATION_20260526

## 需求解读

用户要求取消在 Climate Passport 页面新增的“进入徽章墙/进入成就时间线”按钮。

交互应改为：

1. 点击“成就时间线”标题进入成就页面。
2. 点击“徽章墙”标题进入徽章页面。

## 修改方法

1. 移除 Climate Passport 页面中新增的两个互跳按钮。
2. 将“成就时间线”“徽章墙”标题改为 `Link` 跳转到独立页面。
3. 清理快捷操作中新增的两个页内锚点入口，避免重复入口。

## 修改内容

1. 页面修改
- 文件：`apps/passport-web/components/platform-screens.tsx`
- 变更：
  - 删除“进入徽章墙”按钮。
  - 删除“进入成就时间线”按钮。
  - 删除快捷操作中的两个锚点入口。
  - 将标题改为页面导航：
    - 成就时间线 -> `/[locale]/dashboard/achievements`
    - 徽章墙 -> `/[locale]/dashboard/badges`

2. 验证结果
- 构建：`npm run build` 通过。
- 浏览器验证：
  - 点击“成就时间线”标题可进入成就页。
  - 再点击“查看徽章”可进入徽章页，流程可达。
