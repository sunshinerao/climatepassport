# CHANGE_BADGE_WALL_DESCRIPTION_FONT_SIZE_TUNE_20260527

## 需求解读

用户反馈徽章墙中每个徽章下方的说明文字字号偏大，视觉不协调。

目标是在不影响其它模块说明文字样式的前提下，仅收敛徽章墙说明字号。

## 修改方法

1. 仅在徽章墙卡片作用域内覆盖说明文字样式。
2. 下调字号并微调行高与上间距，保持信息可读且层级弱于徽章名称。

## 修改内容

1. 样式文件修改
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 新增作用域规则：
  - `.passport-dashboard-badge .passport-dashboard-timeline-meta`
- 具体调整：
  - `font-size: 0.71875rem`
  - `line-height: 1.4`
  - `margin-top: 4px`

2. 影响范围
- 仅影响“徽章墙”卡片内说明文字。
- 不影响成就时间线、证书列表、其它模块说明文字。