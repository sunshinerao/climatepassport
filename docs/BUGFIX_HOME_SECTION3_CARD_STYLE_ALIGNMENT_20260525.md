# BUGFIX: 第三部分三卡片交互与文字规格对齐（2026-05-25）

## 需求解读

- 用户要求回到第三部分三张卡片，完成四项对齐：
  - 鼠标移入时有“向上抽出一点点”的动态效果。
  - 1/2/3 绿色圆形直径与第四部分日期圆角方块边长一致，内部数字字体与字号同步。
  - 三张卡片标题文字样式与第四部分卡片标题一致。
  - 三张卡片正文文字大小与 Hero 区域正文（第三块文字）一致。

## 修改方法

- 仅调整第三部分 `.step` 系列样式，不触碰第四部分、Hero 文案或结构。
- 直接采用第四部分标题规格与 Hero 正文规格作为第三部分卡片的目标参数。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .step:hover`
    - 位移改为 `translateY(-8px)`，并增强阴影，形成“向上抽出”动态感。
  - `.proto-home .step-number`
    - 直径改为 `56px`（宽高一致）。
    - 数字样式改为与第四部分日期数字一致方向：`font-family: inherit; font-size: 1.25rem; font-weight: 700;`。
  - `.proto-home .step h3`
    - 对齐第四部分卡片标题：`font-size: 1.125rem; line-height: 1.35; margin-bottom: 10px; font-weight: 700;`。
  - `.proto-home .step p`
    - 对齐 Hero 正文：`font-size: 0.96rem; line-height: 1.75;`。
