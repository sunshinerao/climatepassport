# CHANGE_HEADER_ADMIN_MENU_TARGET_LIST_20260527

## 需求解读

用户明确指定 Header 用户菜单中“管理入口”的目标一级菜单应为：

1. 管理总览
2. 活动管理
3. Learning Experience
4. 证书中心
5. 成就与徽章

## 修改方法

1. 在用户菜单管理项生成函数中，按目标列表重排和重命名。
2. 使用单一“成就与徽章”入口，避免拆分为多个子管理项。
3. 对仅 ADMIN 可访问的“证书中心”继续保留权限控制。

## 修改内容

1. 文件修改
- 文件：`apps/passport-web/components/user-account-menu.tsx`
- 函数：`getAdminMenuItems`

2. 菜单调整
- 将“项目管理 / Program Management”改为：`Learning Experience`
- 新增/保留统一入口：`成就与徽章` -> `/admin/achievements`
- ADMIN 场景下插入：`证书中心` -> `/admin/certificates`
- 移除此前拆分的成就审核独立命名，统一并入“成就与徽章”命名

3. 结果
- Header 管理入口与用户指定列表对齐（在 ADMIN 角色下完整呈现五项）。