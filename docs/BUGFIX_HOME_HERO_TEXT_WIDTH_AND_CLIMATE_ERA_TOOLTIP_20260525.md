# BUGFIX: 首页 Hero 左侧文案宽度、字号与“气候时代”注解提示（2026-05-25）

## 需求解读

- 首页首屏 Hero 左侧文字区域需要更宽，目标为在现有基础上增加约四分之一。
- “属于你的气候时代的可信档案”这句需要放大约 20%。
- “气候时代”四个字需要注解，鼠标悬停时展示说明性 tips。

## 修改方法

- 在 Hero 双栏布局中提升左栏占比，并放宽左栏最大宽度。
- 将该句（Hero 副标题）字体统一上调 20%。
- 在中文标题中将“气候时代”包裹为可悬浮提示的标注元素，使用纯前端样式控制显示隐藏。

## 修改内容

- 修改文件：`apps/passport-web/components/platform-screens.tsx`
  - 中文 Hero 标题改为结构化 JSX：`属于你的` + 可注解 `气候时代` + `的可信档案`。
  - 新增 tips 文案并挂载到 `hero-term-tooltip`。
- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .hero-content`：`max-width` 从 `560px` 调整为 `700px`（容器宽度增加 25%）。
  - `.proto-home .hero-subtitle`：桌面从 `1.5rem` 调整为 `1.2rem`，移动端从 `1.0625rem` 调整为 `0.85rem`（字号缩小 20%）。
  - 新增 `.hero-term-with-tip` 与 `.hero-term-tooltip`，实现悬浮显示注解。

## 二次修正

- 根据用户澄清，“宽度增加四分之一”指文字容器宽度，而非左右栏比例。
- 因此恢复 `.proto-home .proto-home-hero-inner` 为 `1fr 1fr`，仅保留 `hero-content` 容器宽度增加。
- 根据用户澄清，“属于你的气候时代的可信档案”字号改为缩小 20%，已按此执行。
