# BUGFIX: 首页第 3/4/5 部分说明文字与卡片间距固定为 30px（2026-05-25）

## 需求解读

- 用户要求首页第三、第四、第五部分的“说明文字到卡片”的间距统一写死为 30px。
- 这里的间距是指 section header 与下方卡片容器之间的垂直间隔。

## 修改方法

- 仅调整第 3/4/5 部分的 `section-header` 底部间距。
- 将相关区块在桌面与移动端的该间距统一固定为 `30px`，不再使用比例缩放值。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .how-it-works .section-header` 的 `margin-bottom` 改为 `30px`。
  - `@media (max-width: 640px)` 内：
    - `.proto-home .how-it-works .section-header` 仍为 `30px`。
    - `.proto-home .events .section-header` 改为 `30px`。
    - `.proto-home .features .section-header` 改为 `30px`。

- 结果：第 3/4/5 部分说明文字与卡片之间的间距统一固定为 30px。
