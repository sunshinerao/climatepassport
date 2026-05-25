# BUGFIX_MOBILE_NAV_HAMBURGER_AND_HOME_TITLE_SCALING_20260525

## 需求解读

- 用户要求在手机端将顶部导航改为折叠菜单（三条横线），避免导航栏拥挤。
- 用户指出首页 Hero 标题在手机端异常变小，甚至小于副标题/正文，同时第3/4/5/6部分标题也存在同类问题。
- 目标是保持桌面端视觉不变，手机端按桌面比例进行合理缩放。

## 修改方法

- 头部导航：在 `SiteShell` 中增加移动端折叠菜单结构（`details/summary`），并在全局样式中定义汉堡图标、展开面板与断点显隐规则。
- 首页字体：修正 `home.css` 中 `<=640px` 断点下过小的标题 `clamp` 值，并补充 section 级别标题覆盖，保证第3-6部分标题在手机端与正文保持合理层级。
- 验证：执行样式错误检查、移动端页面交互验证与测试回归。

## 修改内容

- 修改文件：`apps/passport-web/components/site-shell.tsx`
  - 桌面导航增加 `nav-desktop` 标识。
  - 新增 `mobile-nav`（`details/summary`）折叠菜单，包含主导航链接。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增 `mobile-nav` 样式：汉堡按钮、三线图标动画、展开面板与菜单项样式。
  - 调整 `@media (max-width: 900px)` 顶栏布局：桌面导航隐藏、移动折叠菜单显示，操作区保持独立一行。

- 修改文件：`apps/passport-web/app/styles/features/home.css`
  - 提升 Hero 标题移动端字号：修复 `proto-title-hero-unified`、`proto-title-zh-single-line` 的过小 `clamp` 值。
  - 提升第3/4/5/6部分主标题移动端字号：为 `.how-it-works/.events/.features .section-title` 增加 `<=640px` 覆盖，维持与桌面端一致的层级比例。
  - 同时将 Hero 副标题字号微调至更协调比例，避免“标题小于正文”的视觉倒挂。

- 验证结果：
  - 移动端：`nav-desktop` 隐藏，`mobile-nav` 显示并可展开；菜单项可见。
  - 移动端字号（390 宽度实测）：
    - Hero 标题约 `26.88px`
    - Hero 副标题约 `15.36px`
    - Hero 正文约 `13.44px`
    - 第3/4/5部分标题约 `24.32px`
  - 语法检查：无错误。
  - `npm test`：`38 passed / 0 failed`。
