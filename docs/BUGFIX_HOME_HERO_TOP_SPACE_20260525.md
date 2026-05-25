# BUGFIX: 首页 Hero 顶部留白恢复修复（2026-05-25）

## 需求解读

- 用户反馈首页 Hero 区域顶部又出现了额外留白。
- 该问题此前已处理过，但在移动端重新出现，需要找到真正的覆盖来源。

## 修改方法

- 通过运行时检查确认：首页容器 `main.page-home` 在移动端被更晚出现的通用 `.page { padding-top: 32px; }` 覆盖。
- 采用最小修复：在同一移动端断点内为 `.page-home` 增加更具体的 `padding-top: 0;` 覆盖规则。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - 在 `@media (max-width: 720px)` 中新增 `.page-home { padding-top: 0; }`。
  - 作用：恢复首页 Hero 顶部贴合顶部导航下方的预期状态，避免通用 `.page` 规则重新引入留白。
