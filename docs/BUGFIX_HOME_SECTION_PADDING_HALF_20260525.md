# BUGFIX: 首页第 3/4/5 部分上下留白减半（2026-05-25）

## 需求解读

- 用户要求首页第三、第四、第五部分每一块的顶部和末尾留白都降低到当前的一半。
- 目标是缩小这三个区块的外层留白，而不是修改卡片、标题或 footer 本身。

## 修改方法

- 仅调整首页这三个 section 的外层 `padding`。
- 将桌面端上下留白从 `100px` 减半到 `50px`。
- 同步把相关响应式断点的 section padding 按相同比例缩小，避免移动端维持过大的块级留白。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .how-it-works`、`.proto-home .events`、`.proto-home .features`
    - 桌面端 `padding` 从 `100px 32px` 调整为 `50px 32px`。
  - `@media (max-width: 980px)`
    - 这三块的 `padding` 从 `72px 24px` 调整为 `36px 24px`。
  - `@media (max-width: 640px)`
    - 这三块的 `padding` 从 `56px 16px` 调整为 `28px 16px`。
