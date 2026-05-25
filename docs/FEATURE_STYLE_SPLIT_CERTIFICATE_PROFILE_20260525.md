# FEATURE_STYLE_SPLIT_CERTIFICATE_PROFILE_20260525

## 需求解读

- 继续推进样式边界拆分，将公开资料页 `cpp-*` 样式从 `globals.css` 迁移到独立 feature 样式文件。
- 目标是降低全局样式复杂度，减少证书资料页与其他页面之间的样式耦合和后续修改风险。
- 本次迁移要求保持选择器与样式行为不变，仅调整样式归属位置。

## 修改方法

- 采用整段迁移策略：按区块边界提取 `cpp-*` 样式到新文件，避免手工重写导致差异。
- 在 `globals.css` 顶部新增 feature 样式导入，保证加载顺序与既有拆分策略一致。
- 删除 `globals.css` 中原 `cpp-*` 区块，确保模块边界清晰。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/certificate-profile.css`
  - 承载公开资料页 `cpp-*` 样式与响应式规则。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/certificate-profile.css";`
  - 删除原有 `cpp-*` 样式段落。

- 校验结果：
  - `globals.css` 中 `.cpp-` 选择器计数为 `0`。
  - `certificate-profile.css` 中 `.cpp-` 选择器计数为 `82`。
