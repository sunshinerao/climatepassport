# BUGFIX: 第五部分尾部留白根因修复（2026-05-25）

## 需求解读

- 用户反馈第五部分下方留白仍然偏大，要求全面检查具体由哪段代码导致。

## 修改方法

- 先从运行时结构与计算样式排查：
  - 第五部分与 footer 相邻关系正常。
  - footer 顶部外边距已被首页规则覆盖为 0。
  - 额外留白仍存在，最终定位为 `main.page-home` 继承了全局 `.page` 的 `padding-bottom: 96px`。
- 采用最小改动：仅在 `page-home` 上显式覆盖底部 padding，不影响其他页面。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - 在 `.page-home` 中新增 `padding-bottom: 0;`。
  - 保留既有 `padding-top: 0;`。

- 结果：首页第五部分后方额外留白（来自页面容器底部 96px）被消除，尾部留白与前序分区逻辑一致。
