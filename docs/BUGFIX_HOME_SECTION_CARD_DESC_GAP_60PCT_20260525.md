# BUGFIX: 首页第 3/4/5 部分说明文字与卡片间距缩至 60%（2026-05-25）

## 需求解读

- 用户要求首页第三、第四、第五部分的“卡片与说明文字之间的间距”减为当前的 60%。
- 当前页面为窄屏视口，因此需以当前移动端实际间距为基准进行缩放。

## 修改方法

- 仅调整第 3/4/5 部分的 `section-header` 与下方卡片容器之间的底部间距。
- 采用移动端断点内的定向覆盖，保持桌面布局不变。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .how-it-works .section-header` 从 `56px` 调整为 `34px`。
  - `@media (max-width: 640px)` 内：
    - `.proto-home .how-it-works .section-header` 维持 `34px`。
    - `.proto-home .events .section-header` 调整为 `24px`。
    - `.proto-home .features .section-header` 调整为 `24px`。

- 结果：第 3/4/5 部分卡片与说明文字之间的间距按当前移动端视觉基准缩至约 60%。
