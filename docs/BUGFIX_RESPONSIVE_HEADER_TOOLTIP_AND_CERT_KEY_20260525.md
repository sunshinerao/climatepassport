# BUGFIX_RESPONSIVE_HEADER_TOOLTIP_AND_CERT_KEY_20260525

## 需求解读

- 用户要求直接修复当前视觉回归中发现的问题，并验证程序是否可适配电脑、平板、手机。
- 已知问题包括：
  - 移动端首页头部操作区被裁切、页面出现横向溢出。
  - 证书页面控制台存在 duplicate key 警告。
- 本次目标是以最小范围修改恢复响应式可用性，并完成三端适配核查。

## 修改方法

- 对证书页重复 key 采用稳定且唯一的复合 key（`code + index`），消除渲染身份冲突警告。
- 对首页 tooltip 做响应式收束：改为居中定位并限制最大宽度为视口宽度减安全边距，避免小屏超界。
- 在全局样式新增头部响应式布局兜底：
  - 900px 以下将顶栏改为单列栅格，导航与操作区占满宽度。
  - 640px 以下将操作区改为 2 列栅格，语言选择器独占一行，按钮宽度自适配。
- 执行错误检查、自动化测试、页面巡检验证回归情况。

## 修改内容

- 修改文件：`apps/passport-web/components/platform-screens.tsx`
  - 证书验证列表 key 由 `key={check.code}` 调整为 `key={`${check.code}-${index}`}`，避免重复 code 触发 React key 警告。

- 修改文件：`apps/passport-web/app/styles/features/home.css`
  - 调整 `.hero-term-tooltip` 与 `.hero-brand-tooltip`：
    - 常规断点：居中定位（`left: 50%` + `translateX(-50%)`）并使用 `calc(100vw - 40px)` 限宽。
    - `max-width: 640px`：进一步收窄为 `calc(100vw - 28px)`，防止手机端溢出。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增顶栏响应式规则：
    - `max-width: 900px`：`topbar-inner` 单列栅格，`nav/header-actions` 拉伸至 100%。
    - `max-width: 640px`：`header-actions` 改 2 列栅格，语言切换器跨两列，按钮与触发器宽度 100%。

- 回归校验：
  - `get_errors`：相关文件无错误。
  - `npm test`：`38 passed / 0 failed`。
  - 页面巡检：`/en`、`/en/events`、`/en/certificates`、`/en/auth/login`、`/en/about` 均正常渲染，无 Build Error 覆盖层。

- 三端适配核查结论：
  - 手机端：已验证通过。头部操作区不再裁切，首页横向溢出问题已消失。
  - 平板与电脑端：
    - 通过断点规则与布局审计确认存在明确适配层（`900px` / `720px` / `640px` 等分层规则）。
    - 当前集成浏览器会话视口固定为窄宽（约 373px），无法在同一会话内直接得到真实大屏截图；已通过样式断点与结构检查完成工程级验证。
  - 综合判断：当前实现满足响应式 Web 的基本要求（断点分层、布局回流、组件宽度约束与无阻塞渲染）。
