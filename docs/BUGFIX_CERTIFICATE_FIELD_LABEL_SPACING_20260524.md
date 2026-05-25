# Certificate Field Label Spacing Bugfix (2026-05-24)

## 需求解读
- 选择模板后，带提示图标的可见变量字段标题与其他普通字段标题相比，和输入框之间的视觉间距不一致。
- 需要让带 `i` 提示的字段标题在签发表单中与普通字段保持一致的垂直节奏。

## 修改方法
- 不改业务逻辑，仅调整通用提示标题样式。
- 让 `field-label-with-info` 按文本基线对齐，而不是居中对齐，避免提示图标参与高度计算后改变标题到底部输入框的视觉距离。

## 修改内容
1. 更新 `apps/passport-web/app/globals.css`
- 将 `.field-label-with-info` 的 `align-items` 从 `center` 调整为 `baseline`。
- 补充 `line-height: 1.2`，使带提示标题与普通标题的文本盒模型更一致。

2. 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
- 为模板变量字段区增加独立容器 `cpca-variable-fields-section`。

3. 更新 `apps/passport-web/app/globals.css`
- 为 `cpca-variable-fields-section` 增加统一的 `margin-top`，让固定签发字段区与模板变量字段区之间的垂直节奏保持一致。
