# BUGFIX: 首页第五部分尾部留白与第三/第四部分对齐（2026-05-25）

## 需求解读

- 用户反馈首页第五部分尾部空白视觉上大于第三、第四部分。
- 期望第五部分底部视觉间距与前面分区保持一致。

## 修改方法

- 定位到根因是全局 footer 的 `margin-top` 在首页生效，叠加在第五部分后方。
- 采用仅首页生效的选择器覆盖，不改全局 footer 默认行为，避免影响其他页面。
- 由于首页结构是 `main.page-home` 后接 `footer.site-footer`，覆盖选择器需基于 `page-home`，不能使用 `.proto-home` 邻接选择器。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增：`.page-home + .site-footer { margin-top: 0; }`
  - 作用：仅当 footer 紧接首页内容时，移除额外顶间距，消除第五部分尾部额外空白。
