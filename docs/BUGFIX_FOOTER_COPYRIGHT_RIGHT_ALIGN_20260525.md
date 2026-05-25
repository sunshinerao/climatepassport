# BUGFIX: Footer 版权区右对齐与导航精简（2026-05-25）

## 需求解读

- 用户要求 footer 做两处微调：
  - 版权部分右对齐。
  - 导航菜单中去掉 `Climate Passport`。

## 修改方法

- 仅修改 footer 对应 JSX 与底部容器样式。
- 保持 footer 其余文案、列结构和页面布局不变。

## 修改内容

- 修改文件：`apps/passport-web/components/site-shell.tsx`
  - 删除导航列中的 `Climate Passport` 菜单项。

- 修改文件：`apps/passport-web/app/globals.css`
  - 将 `.footer-bottom-bar-inner` 设为 `display: flex; justify-content: flex-end;`。
  - 将 `.footer-bottom-bar-inner .footer-disclaimer` 设为 `margin-left: auto; text-align: right;`，使版权文案右对齐。
