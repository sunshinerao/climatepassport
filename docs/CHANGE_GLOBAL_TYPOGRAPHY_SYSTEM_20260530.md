# Global Typography System Standardization (2026-05-30)

## 需求解读

- 目标：除首页外，将平台所有开发板块的字体与字号标准统一到全局体系，避免模块各自定义字体导致视觉漂移。
- 要求：
  - 字体与字号优先使用全局变量与全局类。
  - 页面/板块仅在确有必要时定义独立样式类，且独立类只负责结构/布局，不重复定义新的字体体系。
  - 需要文档化规则，确保后续开发统一执行。

## 修改方法

- 建立全局排版系统文件，统一定义：
  - 字体变量：`--cp-font-sans`、`--cp-font-mono`
  - 字号变量映射：`--cp-fs-*`、`--cp-fs-admin-*`
  - 通用排版工具类：`.cp-type-*`、`.cp-font-*`
- 将全局入口接入该系统：
  - 在 `globals.css` 导入 `typography-system.css`
  - 根布局 `app/layout.tsx` 去除内联 body 字体，完全交给全局样式控制
- 对非首页样式进行批量收敛：
  - 将分散的 `font-family`（Georgia/Inter/system-ui/monospace）统一收敛到全局变量引用
  - 活动管理与活动前台核心页面中的硬编码字号改为全局字号变量

## 修改内容

1. 新增全局排版系统文件
- 文件：`apps/passport-web/app/styles/shared/typography-system.css`
- 内容：
  - 全局字体变量与字号变量映射
  - 全局排版 utility classes（`cp-type-*`, `cp-font-*`）
  - 各模块根容器统一继承 sans 字体的基线规则

2. 全局入口接入
- 文件：`apps/passport-web/app/globals.css`
  - 新增 `@import "./styles/shared/typography-system.css"`
  - `body` 字体改为 `font-family: var(--cp-font-sans)`
- 文件：`apps/passport-web/app/layout.tsx`
  - 删除 `<body>` 的内联字体样式，避免全局重复定义

3. 活动模块（activities/admin-activities）字号统一
- 已将活动列表、活动详情、工作台、排行榜、活动海报及活动后台主要组件中的关键字号改为全局 token。
- 涉及主要文件：
  - `app/[locale]/activities/*`
  - `components/admin-activity-*`
  - `app/styles/features/activity-admin-console.css`
  - `app/styles/features/admin-activities.css`
  - `app/styles/features/admin-create-activity.css`

4. 非首页字体族统一策略（全板块）
- 对 `apps/passport-web/app/styles` 下非 `home.css` 文件执行字体族收敛：
  - serif/sans/mono 不再直接写具体字体栈，统一改为全局变量引用
  - 允许 `font-family: inherit` 作为容器继承语义

5. 页面独立样式类边界（规则）
- 页面/板块独立类允许定义：布局、间距、边框、背景、交互态。
- 页面/板块独立类不应重复定义新的字体体系。
- 如确需特殊字体（例如等宽字段），必须使用全局变量：`var(--cp-font-mono)`，而不是局部硬编码字体名。

6. 验证
- 构建：`npm run build --workspace passport-web` 通过。
- 当前仍存在历史 warning（如 `<img>` 与 hooks 依赖），与本次排版统一改动无直接冲突。

7. 第二轮补充（同日）
- 继续扩展到 activities 相关 admin 列表页（签到/参与/奖励/审核等）与部分 dashboard 展示页，将常见 `0.85em / 0.8em / 0.75em / 0.875rem` 等硬编码字号进一步替换为 `--cp-text-small / --cp-text-caption / --cp-text-body`。
- 新增治理文档：`docs/GLOBAL_TYPOGRAPHY_GOVERNANCE_20260530.md`，明确“全局类优先、模块类仅承载结构”的约束。

8. 第三轮补充（同日）
- 在 `typography-system.css` 增加扩展字号尺度（`--cp-fs-9` 到 `--cp-fs-72`，以及若干 rem 映射变量），用于承接历史遗留的非首页字号字面量。
- 对 `apps/passport-web/app/styles`（排除 `home.css`）执行全量扫描与迁移，将剩余 `font-size: <number>` 统一替换到全局字号变量。
- 对非首页 TSX 内联样式中残余 `fontSize` 字面量执行收敛，统一映射到全局 token（含 poster/checkin 的安全修复）。
- 产出巡检清单文档：`docs/TYPOGRAPHY_AUDIT_NON_HOME_20260530.md`，用于后续门禁与回归检查。
