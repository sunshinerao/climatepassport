# BUGFIX: 首页第 4/5 部分说明文字与卡片间距微调（2026-05-25）

## 需求解读

- 用户反馈第三部分的留白间距合适，但第四、第五部分的间距偏大。
- 说明此前将三块统一固定为同一值后，第四/第五部分视觉上仍显松散，需要单独收紧。

## 修改方法

- 保留第三部分的 30px 间距不变。
- 仅将第四、第五部分的 `section-header` 底部间距进一步缩小。
- 同步在移动端断点与默认规则中保持一致，避免不同屏幕出现不一致的视觉效果。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .events .section-header` 改为 `margin-bottom: 24px`。
  - `.proto-home .features .section-header` 改为 `margin-bottom: 24px`。
  - `@media (max-width: 640px)` 内同样保持 24px。

- 结果：第三部分保持 30px 不变，第四/第五部分说明文字与卡片间距略收紧，视觉更接近一致。
