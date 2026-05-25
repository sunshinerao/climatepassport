# BUGFIX: 第三部分标题三行间距精确归一（2026-05-25）

## 需求解读

- 用户反馈第三部分三行文字之间间距看起来比 Hero 三块文字更大，要求仔细检查并统一。

## 修改方法

- 检查样式后发现第三部分受全局 `.section-header h2` 与元素默认外边距影响，产生了额外垂直间距。
- 在 How It Works 作用域内显式重置并定义三行文字外边距，避免继承与默认值叠加。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .how-it-works .section-label` 设置为 `margin: 0 0 16px;`
  - `.proto-home .how-it-works .section-title` 设置为 `margin: 0 0 16px;`
  - `.proto-home .how-it-works .section-desc` 设置为 `margin: 0;`

- 结果：第三部分三行文字间距统一为 16px（第一段到第二段 16px，第二段到第三段 16px），并消除默认/继承 margin 引发的偏大问题。
