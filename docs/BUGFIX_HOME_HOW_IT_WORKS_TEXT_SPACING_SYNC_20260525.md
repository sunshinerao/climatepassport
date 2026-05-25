# BUGFIX: 第三部分三行文字间距与 Hero 统一（2026-05-25）

## 需求解读

- 用户要求第三部分标题区三行文字之间的间距与 Hero 区域三块文字之间的间距保持一致。

## 修改方法

- 对 How It Works 标题区采用与 Hero 文本块同样的间距标尺。
- 仅调整第三部分标题与描述之间的间距值，保持其余视觉参数不变，避免引入额外版式回归。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - 将 `.proto-home .how-it-works .section-title` 的 `margin-bottom` 从 `18px` 调整为 `20px`。
  - 调整后第三部分三行文字间距与 Hero 的标题/副标题/描述间距规则一致。
