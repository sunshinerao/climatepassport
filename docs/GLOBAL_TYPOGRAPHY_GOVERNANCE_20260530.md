# Global Typography Governance (2026-05-30)

## 需求解读

- 目标：确保除首页以外的所有开发板块，在字体和字号层面使用同一套全局系统，杜绝模块内各自定义字体体系。
- 范围：`apps/passport-web` 下所有非首页页面与组件。
- 原则：
  - 全局统一：字体与字号必须优先使用全局变量/全局类。
  - 局部独立：页面或模块可以有独立样式类，但独立类仅承载结构与视觉布局，不重新定义一套排版系统。

## 修改方法

1. 建立并强制使用全局排版入口。
2. 将非首页样式中的字体声明统一收敛到全局字体变量。
3. 将业务页面与组件中的常见硬编码字号逐步迁移到 token。
4. 通过文档约束后续新增代码的写法，避免回归。

## 修改内容

### 1) 全局排版系统

- 文件：`apps/passport-web/app/styles/shared/typography-system.css`
- 全局字体变量：
  - `--cp-font-sans`
  - `--cp-font-mono`
- 全局字号映射变量：
  - `--cp-fs-caption` / `--cp-fs-small` / `--cp-fs-body` / `--cp-fs-body-lg`
  - `--cp-fs-admin-caption` / `--cp-fs-admin-small` / `--cp-fs-admin-body` / `--cp-fs-admin-body-lg`
  - 扩展尺度：`--cp-fs-9` ~ `--cp-fs-72` 与 rem 映射变量（用于历史字号平滑迁移）
- 全局 utility class：
  - `.cp-font-sans`, `.cp-font-mono`
  - `.cp-type-caption`, `.cp-type-small`, `.cp-type-body`, `.cp-type-body-lg`
  - `.cp-type-admin-caption`, `.cp-type-admin-small`, `.cp-type-admin-body`, `.cp-type-admin-body-lg`

### 2) 全局接入要求

- 文件：`apps/passport-web/app/globals.css`
  - 必须导入 `typography-system.css`。
  - `body` 必须使用 `font-family: var(--cp-font-sans)`。
- 文件：`apps/passport-web/app/layout.tsx`
  - 不允许再写 body 的内联字体样式。

### 3) 模块独立类边界

- 页面或模块独立类（如 `activity-*`, `admin-*`, `proto-*`, `cpca-*`）允许定义：
  - 布局、间距、背景、边框、阴影、交互状态。
- 页面或模块独立类不应定义：
  - 新字体家族（如新增 serif/sans 字体栈硬编码）。
  - 与全局 token 冲突的零散字号体系。
- 若确需等宽字体，仅允许：`font-family: var(--cp-font-mono)`。

### 4) 新增代码准入规则

- 不允许在非首页新增硬编码字体栈，例如：
  - `font-family: Georgia...`
  - `font-family: Inter...`
  - `fontFamily: "monospace"`
- 新增字号优先使用 token：
  - 正文：`var(--cp-text-body)`
  - 次正文：`var(--cp-text-small)`
  - 说明/标签：`var(--cp-text-caption)`
  - 管理台对应使用 `--cp-admin-text-*`

### 5) 例外策略

- 首页视觉实验（`home.css`）作为单独视觉域保留例外，不纳入本治理规则。
- 海报/打印等“固定版式渲染”允许保留少量绝对字号用于视觉构图，但必须在页面顶部注明用途并限制在该文件内部。

### 6) 巡检与门禁

- 每次合并前必须执行一次非首页巡检：
  - CSS：扫描 `font-size: <number>`（排除 `home.css`）
  - TSX：扫描 `fontSize` 数字或数字字符串字面量（排除首页视觉文件）
- 新增字号若现有 token 不可表达，必须先补充到 `typography-system.css`，再在业务代码引用。
