# CHANGE_SYSTEM_MANAGEMENT_BRANDING_SETTINGS_20260527

## 需求解读

本次需求是在后台新增“系统管理”菜单，允许管理员维护网站级品牌信息。

核心诉求：

1. 可以配置网站名称与基础对外信息。
2. Logo 支持两套：彩色版与反白版。
3. 配置完成后可实际影响站点头部/页脚展示，而不是仅保存数据。

同时补充了系统管理常用字段，便于后续运营无需改代码即可维护站点形象与联系信息。

## 修改方法

1. 扩展 Prisma 数据模型，新增站点级配置表 `site_settings`，采用 `key=platform` 的单例配置模式。
2. 新增后台系统管理页面与 API：
   - 管理页负责表单编辑与图片上传（前端转 data URL）。
   - API 负责权限校验、字段校验和 upsert 持久化。
3. 更新后台导航：
   - 在 Admin Shell 与账户下拉“管理入口”中加入“系统管理”。
4. 接入站点渲染：
   - 头部使用彩色 Logo（若存在）。
   - 页脚优先使用反白 Logo（无反白时回退彩色）。
   - 网站名、标语、支持邮箱/网站、版权文案改为动态读取配置。

## 修改内容

1. 数据层
- 更新：`prisma/schema.prisma`
  - 新增模型 `SiteSetting`（映射 `site_settings`）。
- 新增迁移：`prisma/migrations/20260527130000_site_settings_system_management/migration.sql`
  - 创建 `site_settings` 表与唯一索引。
  - 插入默认平台配置（`key=platform`）。

2. 后台菜单与入口
- 更新：`apps/passport-web/components/admin-shell.tsx`
  - 新增 `/${locale}/admin/system` 菜单项（系统管理）。
- 更新：`apps/passport-web/components/user-account-menu.tsx`
  - 管理入口增加“系统管理”。
- 更新：`apps/passport-web/app/[locale]/admin/page.tsx`
  - 管理总览增加“系统管理”模块卡片。

3. 系统管理页面与 API
- 新增：`apps/passport-web/app/[locale]/admin/system/page.tsx`
- 新增：`apps/passport-web/components/admin-system-settings-client.tsx`
  - 可维护字段包括：
    - 网站名称（中/英）、短名称
    - 网站标语（中/英）
    - 彩色 Logo、反白 Logo、Favicon
    - 支持邮箱、电话、支持网站
    - 版权文案（中/英）、ICP备案号
    - 主题色、深色主题色
- 新增：`apps/passport-web/app/api/admin/system/settings/route.ts`
  - 仅 `ADMIN` 可访问。
  - 支持 `GET/PATCH`。
  - 增加 data URL 图片格式校验与支持网站 URL 校验。

4. 站点壳动态品牌接入
- 新增：`apps/passport-web/lib/server/site-settings.ts`
  - 提供 `getSiteBranding(locale)`。
- 更新：`apps/passport-web/components/site-shell.tsx`
  - 头部/页脚 Logo 与品牌文案改为读取系统配置。
  - 支持邮箱/网站与版权文案改为配置化。

5. 样式补充
- 更新：`apps/passport-web/app/globals.css`
  - 新增头部品牌图片样式 `.brand-logo-image`。
- 更新：`apps/passport-web/app/styles/shared/footer.css`
  - 新增页脚品牌图片样式 `.footer-brand-logo-image`。
