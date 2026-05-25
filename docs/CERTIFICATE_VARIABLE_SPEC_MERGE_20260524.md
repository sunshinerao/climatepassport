# 证书变量规范合并说明

## 需求解读

将证书变量草案升级为产品规范的一部分，作为后续证书模板、签发、预览和导出的统一基准。目标不是继续扩充字段数量，而是把变量分层、双语字段和场景语义族的规则固定下来，避免后续模板越做越碎。

## 修改方法

- 把草案中的变量体系合并到 `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`，让它成为正式的产品基线。
- 保留产品规范中已有的固定字段，尤其是完成日期、学习时长、能力标签、签名人、机构名称等。
- 采用分层式变量设计：核心固定变量、需要中英独立字段的变量、场景语义族变量、后续再评估变量。
- 将草案中的细节保留为参考，但不再把它作为独立的决策来源。

## 修改内容

- 更新 `docs/CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`：
  - 将原先的平铺式 Template variables 列表改为分层式规范。
  - 明确保留 `completionDate`、`learningHours`、`capabilityTags`、`signer`、`institutionName` 等产品字段。
  - 增加 `holderName`、`certificateName`、`categoryName`、`workName`、`eventName`、`projectName`、`programName`、`courseName`、`roleName`、`organizationName` 等字段的中英独立命名规则。
  - 补充场景语义族与显示名复用原则。
- 新增 `docs/CERTIFICATE_VARIABLE_SPEC_MERGE_20260524.md`：
  - 记录合并决策和后续执行基线。
  - 方便后续在模板变量或签发字段扩展时统一引用。