# BUGFIX_HOME_NAVIGATION_SPACING_STATE_DRIFT_20260525

## 需求解读

- 用户反馈：首页与内页在“客户端导航”和“刷新”之间出现间距状态不一致：
  - 首页进入内页后正文有时贴住 header/footer；刷新后恢复正常。
  - 返回首页后 Hero 和 section-5 下方留白有时又异常。
- 这说明问题不仅是数值，而是页面状态判定在导航链路中存在漂移。

## 修改方法

- 去除 `SiteShell` 对“首页 class 切换”的请求头路径依赖，避免客户端跳转时状态抖动。
- 统一 `main` 为稳定 class `page`，再用结构选择器让首页样式按 DOM 内容自动生效：
  - `.page:has(.proto-home)` 作为首页识别条件。
- 保持最小改动，不改变既有留白目标值，只修复状态漂移机制。

## 修改内容

- 修改文件：`apps/passport-web/components/site-shell.tsx`
  - 移除 `isLocaleHome` 的路径判定分支。
  - `main` class 统一为 `page`。

- 修改文件：`apps/passport-web/app/styles/features/home.css`
  - ` .page.page-home ` -> ` .page:has(.proto-home) `
  - ` .page-home + .site-footer ` -> ` .page:has(.proto-home) + .site-footer `
  - 保持首页间距收敛逻辑不变，但触发机制改为结构判定。

- 验证结果（复现链路）：
  - `/zh` 首屏：`main.page` 计算值 `0/0`。
  - 客户端点击到 `/zh/events`：`main.page` 计算值 `64/96`。
  - 浏览器刷新 `/zh/events`：仍为 `64/96`（无跳变）。
  - 点击左上返回 `/zh`：恢复 `0/0`（无跳变）。

- 自动化验证：
  - `npm test`：`38 passed / 0 failed`。
