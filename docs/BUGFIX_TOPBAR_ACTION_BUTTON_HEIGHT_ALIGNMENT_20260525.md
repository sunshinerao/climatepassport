# BUGFIX: 首页顶部右侧操作按钮高度统一（2026-05-25）

## 需求解读

- 用户要求首页顶部右侧按钮在登录前后保持一致高度。
- 特别强调：登录后“头像+用户名”账户按钮必须与语言切换按钮高度一致。
- 调整应为样式层的最小修改，不改变现有交互与信息结构。

## 修改方法

- 在全局样式中新增统一高度变量 `--cp-header-action-height`，作为顶部操作按钮基线。
- 将 `account-menu-trigger` 与 `locale-trigger` 的最小高度统一到该变量。
- 为避免账户按钮因头像尺寸导致视觉高度偏大，微调账户按钮内边距与头像尺寸。
- 将登录/注册按钮使用的 `nav-action` 同步到相同高度基线，确保未登录态一致。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
- 具体变更：
  - 在 `:root` 新增 `--cp-header-action-height: 42px`。
  - `.account-menu-trigger`：`min-height` 统一为变量；`padding` 从 `5px 10px 5px 6px` 调整为 `4px 10px 4px 6px`。
  - `.account-avatar`：尺寸从 `34px` 调整为 `32px`，使账户按钮与其他顶部操作按钮达到同一高度基线。
  - `.locale-trigger`：`min-height` 统一为变量。
  - `.nav-action`：显式同步 `min-height` 到统一变量，保证登录/注册按钮与语言按钮一致。
