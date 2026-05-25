# BUGFIX: 第四/第五部分三行标题区格式对齐（2026-05-25）

## 需求解读

- 用户要求按与第三部分相同的格式，修改第四部分与第五部分的三行文字（label/title/description）。
- 明确要求只改这两部分，其他内容先不动。

## 修改方法

- 在首页样式文件中仅针对 `events` 与 `features` 区块的 `section-header` 三行文字进行格式对齐。
- 不修改这两个区块的文案内容、卡片布局、颜色、间距以外的视觉参数。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增 `.proto-home .events .section-header` 与 `.proto-home .features .section-header`：使用垂直居中堆叠布局（`display: flex; flex-direction: column; align-items: center; justify-content: center;`）。
  - 新增 `.proto-home .events .section-label` 与 `.proto-home .features .section-label`：`margin: 0 0 16px;`。
  - 新增 `.proto-home .events .section-title` 与 `.proto-home .features .section-title`：
    - `font-size: clamp(0.84rem, 2.94vw, 2.35rem)`
    - `line-height: 1.15`
    - `margin: 0 0 16px`
  - 新增 `.proto-home .events .section-desc` 与 `.proto-home .features .section-desc`：`margin: 0;`。
