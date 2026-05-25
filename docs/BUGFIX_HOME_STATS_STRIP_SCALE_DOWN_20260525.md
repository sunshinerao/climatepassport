# BUGFIX: Hero 下方统计区高度与数字字号缩减（2026-05-25）

## 需求解读

- 用户要求将 Hero 下方统计区域整体背景高度缩小约 15%。
- 同时将统计数字字号缩小约 15%。

## 修改方法

- 通过调整统计区 `padding` 的纵向值来降低整体背景高度。
- 通过调整 `.stat-value` 字号实现数字视觉缩放。
- 桌面与移动端分别同步调整，保持比例一致。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
- 具体改动：
  - `.proto-home .proto-stats-strip`
    - 桌面：`padding: 56px 32px` -> `48px 32px`
    - 移动：`padding: 40px 16px` -> `34px 16px`
  - `.proto-home .stat-value`
    - 桌面：`font-size: 2.75rem` -> `2.34rem`
    - 移动：`font-size: 2rem` -> `1.7rem`
