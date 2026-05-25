# BUGFIX: 首页 Passport 持有者指标改为 Climate Passport 持有者数量（2026-05-25）

## 需求解读

- 用户要求首页 Hero 下方统计区中 “Passport持有者 / Passport holders” 指标，不应统计全部用户数。
- 正确口径应为：统计拥有 Climate Passport ID 的用户数量。
- 该统计不区分是否激活状态，即不加 `status=ACTIVE` 过滤。

## 修改方法

- 在首页数据加载函数 `getHomePageData` 中，将第一项统计查询从 `prisma.user.count()` 改为按 `climatePassportId` 非空条件计数。
- 保持指标展示结构、排序、格式化逻辑不变，仅替换第一项数值来源。

## 修改内容

- 修改文件：`apps/passport-web/lib/server/platform-data.ts`
- 具体改动：
  - `user.count()` 改为 `user.count({ where: { climatePassportId: { not: null } } })`
  - 变量 `userCount` 改名为 `passportHolderCount`
  - 指标数组第一项的 `value` 改为 `passportHolderCount` 格式化结果
