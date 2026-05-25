# FEATURE_STYLE_SPLIT_PROTOTYPE_ALIGNMENT_V3_20260525

## 需求解读

- 继续执行样式边界拆分，将 `globals.css` 中 `Prototype alignment v3` 聚合样式区块拆分到独立 feature 文件。
- 目标是降低全局样式文件复杂度，强化 `proto-*` 体系样式的模块边界与维护可控性。
- 迁移必须保持视觉与交互行为一致，不改选择器语义，仅调整样式归属。

## 修改方法

- 以注释边界为锚点，整段提取 `Prototype alignment v3` 区块到新文件，避免手工改写造成差异。
- 在 `globals.css` 顶部接入新 feature 导入，保持拆分后的样式加载顺序稳定。
- 从 `globals.css` 删除原 `Prototype alignment v3` 段落，保留其他非目标区块。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/prototype-alignment-v3.css`
  - 承载 `Prototype alignment v3` 区块样式（含 `proto-*` 相关增强与响应式规则）。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/prototype-alignment-v3.css";`
  - 删除原 `Prototype alignment v3` 区块。

- 校验结果：
  - `globals.css` 中不再保留 `Prototype alignment v3` 区块注释。
  - `prototype-alignment-v3.css` 中保留该区块完整样式内容。
