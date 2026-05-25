# BUGFIX_SUMMER_SCHOOL_ADMIN_MENU_LABEL_RENAME_20260525

## 需求解读
- 用户要求将管理后台中原菜单名称“夏校申请，临时功能”改名为“*夏校申请列表”。
- 目标是统一后台导航文案，降低“临时功能”字样带来的认知噪音。

## 修改方法
- 仅修改后台左侧导航构建函数中的该菜单标签文案。
- 保持路由、权限、菜单层级与其它导航项逻辑不变，确保是纯文案改动。

## 修改内容
- 修改文件：`apps/passport-web/components/admin-shell.tsx`
- 将 Summer School 管理菜单项文案：
  - 中文从 `夏校申请，临时功能` 调整为 `*夏校申请列表`
  - 英文同步调整为 `Summer School applications list`
- 菜单路径和权限保持不变：
  - 路径：`/[locale]/admin/summer-school/applications`
  - 角色：`ADMIN`