# CHANGE_HEADER_ADMIN_MENU_TOP_LEVEL_ONLY_20260527

## 需求解读

用户要求在 Header 区域用户菜单中，“管理入口”部分仅保留管理功能的一级菜单，不展示二级管理入口。

## 修改方法

1. 调整用户菜单中的管理入口生成函数。
2. 保留一级管理页面链接。
3. 移除明显二级/子功能链接（如 applications、badges definitions/awards 等）。

## 修改内容

1. 文件修改
- 文件：`apps/passport-web/components/user-account-menu.tsx`
- 函数：`getAdminMenuItems`

2. 保留的一级管理菜单
- `/admin` 管理总览
- `/admin/events` 活动管理
- `/admin/learning-experiences` 项目管理
- （ADMIN）`/admin/certificates` 证书签发
- （ADMIN）`/admin/achievements` 成就审核

3. 移除的二级菜单
- `/admin/learning-experiences/applications`
- `/admin/badges/definitions`
- `/admin/badges/awards`
- `/admin/summer-school/applications`

4. 影响范围
- 仅影响 Header 用户菜单中的“管理入口”列表展示。
- 不影响后台管理页面本身路由与权限控制。