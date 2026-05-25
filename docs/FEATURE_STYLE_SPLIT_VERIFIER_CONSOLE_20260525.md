# FEATURE_STYLE_SPLIT_VERIFIER_CONSOLE_20260525

## 需求解读

- 继续推进前端样式边界拆分，将 verifier 控制台 `proto-verifier-*` 样式从 `globals.css` 迁移到 feature 样式文件。
- 本次目标是减少全局样式负担，进一步明确证书验证控制台样式归属，降低跨模块改动风险。
- 迁移过程必须保持 UI 行为不变，不改选择器命名，仅调整样式存放位置。

## 修改方法

- 采用整段迁移：将 verifier 注释段后的全部 `proto-verifier-*` 样式整体提取到新文件，避免人工改写差异。
- 在 `globals.css` 顶部导入新 feature 样式文件，保持拆分后样式生效顺序稳定。
- 从 `globals.css` 删除原 verifier 样式段，确保边界清晰。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/verifier-console.css`
  - 承载 verifier 控制台全部 `proto-verifier-*` 样式。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/verifier-console.css";`
  - 删除原 `proto-verifier-*` 样式段。

- 校验结果：
  - `globals.css` 中 `proto-verifier-` 计数为 `0`。
  - `verifier-console.css` 中 `proto-verifier-` 计数为 `35`。
