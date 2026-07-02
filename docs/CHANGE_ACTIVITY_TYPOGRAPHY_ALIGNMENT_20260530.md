# Activity Typography Alignment Change Log (2026-05-30)

## 需求解读

- 目标：检查 activities 相关页面的字体与字号，确保和 climate-passport 全局视觉规范保持一致。
- 范围：活动管理后台样式（列表、详情、创建）与活动前台关键页面（列表、详情、工作台、排行榜）。
- 约束：不调整业务逻辑、不改 API，仅进行样式与展示层字号对齐。

## 修改方法

- 先以全局样式基线为准：`app/globals.css` 中的 Inter + `--cp-text-*` / `--cp-admin-text-*` token。
- 对活动相关样式进行差异扫描，重点处理：
  - 独立 serif 字体（与全站 sans 不一致）
  - 关键页面内联硬编码字号（`0.7rem` / `0.8rem` / `0.85em` 等）
- 将可统一的字号替换为全局 token 变量，减少局部“漂移”。

## 修改内容

1. 后台活动列表页字体统一
- 文件：`apps/passport-web/app/styles/features/admin-activities.css`
- 变更：
  - 为 `.admin-activities-content` 增加 `font-family: inherit`，并设置 admin 级基准字号与行高。
  - 将 `.admin-page-header-text h2` 从 Georgia 改为继承字体（全站 sans），并统一标题层级尺寸。
  - 将说明文本、统计标签、状态标签、tooltip 文本对齐至 `--cp-admin-text-*` / `--cp-text-caption`。

2. 后台活动详情控制台字号对齐
- 文件：`apps/passport-web/app/styles/features/activity-admin-console.css`
- 变更：
  - 将 hero 标题、统计数字、卡片标题、面板标题由硬编码 px 调整为与全站一致的标题/文本尺度。
  - 将元信息、描述、链接、表单标签等统一映射到 `--cp-admin-text-caption` / `--cp-admin-text-small`。

3. 后台活动创建页基准字体对齐
- 文件：`apps/passport-web/app/styles/features/admin-create-activity.css`
- 变更：
  - 为 `.create-activity-wrap` 增加 `font-family: inherit`，并设置 admin 级基准字号与行高，确保页面整体不偏离全局排版。

4. 活动前台页面内联字号 token 化
- 文件：
  - `apps/passport-web/app/[locale]/activities/page.tsx`
  - `apps/passport-web/app/[locale]/activities/[slug]/page.tsx`
  - `apps/passport-web/app/[locale]/activities/[slug]/workspace/page.tsx`
  - `apps/passport-web/app/[locale]/activities/[slug]/leaderboard/page.tsx`
- 变更：
  - 将关键内联字号从局部 rem/em 常量改为 `--cp-text-caption` / `--cp-text-small` / `--cp-text-body`。
  - 排行榜中原局部 monospace 文本改回页面统一字体体系，避免局部视觉跳脱。

5. 验证结果
- 类型与语法检查：相关文件 `get_errors` 无报错。
- 构建验证：`npm run build --workspace passport-web` 通过。
- 备注：保留既有非阻断 warning（如部分 `<img>` 和 hooks 依赖提示），与本次字号/字体对齐改动无直接冲突。
