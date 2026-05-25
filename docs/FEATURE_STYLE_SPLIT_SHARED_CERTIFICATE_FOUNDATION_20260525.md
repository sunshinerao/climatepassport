# FEATURE_STYLE_SPLIT_SHARED_CERTIFICATE_FOUNDATION_20260525

## 需求解读

- 在继续执行后续样式拆分时，`globals.css` 中仍存在较大且高内聚的证书模块基础样式段（`certificate-*`）。
- 需要将该段下沉到 shared 层，进一步降低 globals 复杂度，同时保持页面视觉与行为一致。

## 修改方法

- 按完整区段提取证书基础样式（包含其移动端响应式规则）到 shared 文件。
- 在全局入口增加 import，保持加载顺序稳定。
- 从 globals 删除对应源区段，并修复抽取过程中暴露的残缺注释头，避免后续维护歧义。
- 通过错误检查与测试确认无回归。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/shared/certificate-foundation.css`
  - 承载 `certificate-card-grid` 到证书列表/校验页相关规则，以及 `@media (max-width: 920px)` 下对应证书模块响应式规则。
  - 修复原段中的注释残缺，将异常注释行替换为 `/* Certificate preview details */`。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/shared/certificate-foundation.css";`
  - 删除已迁移的证书基础样式区段。

- 校验结果：
  - `get_errors`：`globals.css` 与 `certificate-foundation.css` 均无错误。
  - 选择器检查：`globals.css` 中仅残留历史 `certificate-grid` 相关规则，不再包含本次迁移的证书基础大段。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
