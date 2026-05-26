# CHANGE_ACHIEVEMENT_BADGE_ENTRY_IN_CLIMATE_PASSPORT_20260526

## 需求解读

用户要求将“成就/徽章”从独立菜单入口收口到 Climate Passport 页面：

1. 不再在用户菜单中单独挂载“成就”“徽章”入口。
2. 成就与徽章能力应在 Climate Passport 页面内直接实现与展示。
3. 其他页面涉及回跳入口时，优先回到 Climate Passport 页面。

## 修改方法

1. 调整导航入口：移除用户账户菜单中的成就/徽章独立项，并将 Dashboard 快捷操作改为统一进入 Climate Passport。
2. 扩展 Climate Passport 数据层：在 `getPassportPageData` 中接入新成就/徽章模型，返回“成就时间线”和“徽章墙”数据。
3. 扩展 Climate Passport 视图层：在 Climate Passport 页面新增成就时间线与徽章墙模块，使用真实数据渲染。
4. 调整徽章验证页回跳：从“返回徽章页”改为“返回 Climate Passport”。

## 修改内容

1. 导航入口调整
- `apps/passport-web/components/user-account-menu.tsx`
  - 删除用户快捷入口中的：
    - `/dashboard/achievements`
    - `/dashboard/badges`
- `apps/passport-web/app/[locale]/dashboard/page.tsx`
  - 将快捷操作中的“成就时间线/徽章墙”两个链接合并为“成就与徽章”，统一指向：
    - `/dashboard/climate-passport`

2. Climate Passport 数据整合
- `apps/passport-web/lib/server/platform-data.ts`
  - 新增 `P2021` 缺表识别函数，避免未迁移环境导致页面中断。
  - 在 `getPassportPageData` 中新增查询：
    - `achievement`（成就时间线）
    - `badgeDefinition` + `badgeAward`（徽章墙 + 已解锁状态）
  - 新增返回字段：
    - `achievementTimeline`
    - `badgeWall`
  - 在 no-user/fallback 分支补齐上述字段，保证类型稳定。

3. Climate Passport 页面实现
- `apps/passport-web/components/platform-screens.tsx`
  - `ClimatePassportScreen` 新增并渲染：
    - 成就时间线卡片（时间、标题、描述/验证级别）
    - 徽章墙卡片（锁定/解锁、徽章名、描述）
  - 由此实现“成就/徽章在 Climate Passport 页面内呈现”，不依赖独立菜单入口。

4. 徽章验证回跳调整
- `apps/passport-web/app/[locale]/verify/badge/[token]/page.tsx`
  - 按钮由“返回徽章页”改为“返回 Climate Passport”。

5. 验证结果
- `npm run build` 通过（仅保留既有无关 Hook warnings）。
- `npm test` 38/38 通过。
- 浏览器核验：
  - 用户菜单已无“成就/徽章”独立项。
  - Climate Passport 页面已显示“成就时间线”和“徽章墙”模块。
