# Climate Passport 页面精修变更说明（2026-05-26）

## 需求解读

本次聚焦 Climate Passport 页面的 4 个精修点：

1. 将角色 badge 与姓名放到同一行，保持现有字体与字号，仅优化间距和排版。
2. 将资料完整度圆环改为全局绿色-金色体系：50% 以下偏绿色，超过 50% 后向金色渐变，到 100% 更接近金色。
3. 将“完善我的资料”入口改为用户资料维护界面：
   - 可编辑除姓名、邮箱外的个人字段；
   - 支持安全修改密码（校验当前密码 + 新密码强度/一致性）；
   - 按 Tab 分组展示。
4. 扩充成就徽章体系，并与积分阈值绑定：达到对应积分即可解锁对应成就。

## 修改方法

1. UI 结构调整：
   - 在 Climate Passport 头部将姓名和角色 badge 包装到同一 flex 行容器。
   - 调整移动端样式，确保换行和间距合理。
2. 渐变环算法：
   - 在全局变量定义绿色/金色主色和柔和色。
   - 圆环使用 CSS 变量 + `color-mix` 动态计算当前区间色，结合完成度百分比渲染 conic-gradient。
3. 资料维护能力：
   - 新增 `/[locale]/dashboard/profile` 页面及客户端表单组件。
   - 新增 API：
     - `PATCH /api/dashboard/profile` 更新用户资料与组织信息；
     - `PATCH /api/dashboard/profile/password` 安全改密。
   - Climate Passport 页面入口统一跳转到新资料维护页。
4. 成就与积分联动：
   - 在 `getPassportPageData` 中补齐默认积分型成就定义（缺失时自动创建）。
   - 按用户积分自动判定可解锁成就，并写入 `UserAchievement`。
   - 徽章列表改为按定义全量渲染（包含已解锁/未解锁），文案显示积分阈值条件。

## 修改内容

- 主要页面与样式：
  - `apps/passport-web/components/platform-screens.tsx`
    - 角色 badge 与姓名同行；
    - 资料完整度圆环使用动态样式变量；
    - “完善我的资料/编辑资料”链接改到 `/dashboard/profile`；
    - 新增 `ProfileMaintenanceScreen`。
  - `apps/passport-web/app/styles/features/dashboard-redesign.css`
    - 新增 `.passport-dashboard-hero-identity` 行内布局；
    - 改造 `.passport-dashboard-progress-wrap` 渐变逻辑；
    - 新增 profile maintenance tab/grid 样式与移动端适配。
  - `apps/passport-web/app/globals.css`
    - 新增全局绿色/金色渐变相关变量。

- 新增资料维护模块：
  - `apps/passport-web/app/[locale]/dashboard/profile/page.tsx`
  - `apps/passport-web/components/profile-maintenance-form.tsx`
  - `apps/passport-web/app/api/dashboard/profile/route.ts`
  - `apps/passport-web/app/api/dashboard/profile/password/route.ts`

- 成就与积分阈值扩展：
  - `apps/passport-web/lib/server/platform-data.ts`
    - 新增默认积分成就定义和自动补齐函数；
    - 在 Passport 数据加载时执行积分阈值解锁同步；
    - 徽章列表改为全量定义驱动并显示解锁条件。
