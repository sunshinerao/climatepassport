# BUGFIX_HOME_TOOLTIP_BUTTON_AND_SECTION_SPACING_20260525

## 需求解读

- 用户提出首页三个交互与视觉细节问题：
  1. `气候时代` 与 `Climate Passport` 的 hover tip 不应以鼠标居中定位，应改为左对齐弹出。
  2. `探索活动` 按钮 hover 时文字颜色发白导致不可见。
  3. 第五部分末尾留白高度需与第四部分末尾留白保持一致。
- 要求仅修复问题，不破坏既有页面稳定性。

## 修改方法

- 在首页样式文件中做定向调整（`.proto-home` 作用域），避免影响非首页。
- tooltip 定位从 `left: 50% + translateX(-50%)` 改为 `left: 0 + transform: none`，使弹层左对齐触发词。
- 为首页 Hero CTA 的 `button-outline` 增加显式 hover 可读性规则，确保文字在 hover 时持续可见。
- 让 section-5（features）底部留白策略与 section-4（events）一致：删除 features 的额外 `padding-bottom` 压缩值，恢复与 events 同步。

## 修改内容

- 修改文件：`apps/passport-web/app/styles/features/home.css`
  - Tooltip 左对齐：
    - `.hero-term-tooltip`：`left: 0; transform: none;`
    - `.hero-brand-tooltip`：`left: 0; transform: none;`
    - 移动端断点同样改为左对齐（不再居中平移）。
  - `探索活动` 按钮 hover 可见性：
    - 新增 `.proto-home .hero-ctas .button-outline:hover` 明确文字、背景和边框颜色。
  - 第4/5部分尾部留白对齐：
    - `features` 从 `padding: 50px 32px 30px` 调整为 `padding: 50px 32px`。
    - 删除 `<=980` 与 `<=640` 下 `features` 的额外 `padding-bottom` 特殊值，使其与 `events` 一致。

- 验证结果：
  - Tooltip 定位：计算样式为 `left: 0px`、`transform: none`。
  - `探索活动` 按钮 hover：文本颜色维持可读（未出现白字不可见）。
  - section-4/5 尾部留白：计算样式 `events padding-bottom == features padding-bottom`（当前视口下均为 `28px`）。
  - `npm test`：`38 passed / 0 failed`。
