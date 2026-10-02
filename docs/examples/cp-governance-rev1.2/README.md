# cp-governance/1 revision 1.2 — 离线消息样例

这些样例供站点开发者核对消息结构与已批准语义。使用已安装的实际 `GovernanceCommandSchema` / `GovernanceQualificationSchema`，不复制或扩展生产schema。没有身份解析、账号、绑定登记、鉴权、真实同意、DB、网络、服务或奖励发放。`.invalid` issuer、全零前缀UUID、subject及receipt均为无效惰性占位值，不能作为真实证明。不能把本地“上下文一致”当作CP受理、资格通过或发奖成功。

`messages/*.json` 是完整的单条原样消息；`cases.json`记录预期；`contexts.json`是虚构的登记/入场/当前head元数据。后两份文件及`transmittedAt`不是wire字段，不得随事件发送。必须换成CP owner正式核验的上下文，随后仍由真实CP检查权限、身份、当前用途同意与DB状态；本地预检不能代替该检查。validator永远返回 `qualificationAccepted:false`、`rewardApplied:false`。

## 常见差距

| 消息／关系 | 要点 |
|---|---|
| programme-as-project-invalid | UUID结构通过不等于项目引用正确；Programme ID不能代替已登记具体活动/课程期次/挑战单元ID。不可仅从标题推断粒度；owner须明确mapping。 |
| separate-unit-same-programme-valid | 同Programme的两个具体期次保持各自project/participation；不同网站的同一单元共享一个participation。样例只比较已声明引用，不计算或授予奖励。 |
| entry-without-rule-pin-invalid / first-fact-switches-rule-invalid | 入场已有固定ruleVersionId，不能等首个事实再选“最新版本”；首个来源head为0也不允许换版。 |
| retired-historical-correct-valid | 已入场历史记录可按原窗口更正。例中10月10日传送、事实10月2日发生；退役不解释成无条件拒绝纠错。 |
| transmission-time-as-fact-invalid / exclusive-window-end-invalid / fact-before-admission-invalid | correct的occurredAt须是该版本所描述事实的真实发生时间，而非传送时间；原规则validUntil排他，且不早于入场。不得倒造事实时间或同意。 |
| gca-first-v1-valid / fs-independent-v1-valid / other-source-head-invalid | 版本是各binding/source record自己的时钟；两来源均可v1，FS不能用GCA的head作supersedes。 |
| exact-immutable-replay-valid / same-id-changed-body-invalid / new-id-reuses-version-invalid | 相同ID与相同规范化内容是重送；改内容需要correct的新ID/下一版本/本源head。JSON属性顺序不改变内容身份。 |
| gca-with-fs-fact-invalid | wire union形状通过也不能让GCA报告FS accepted作品事实；获批来源上下文另限制kind/status。 |
| qualification-sourceapp-extension-invalid | sourceApp属于来源配置，不是资格事件额外字段；不能给事件加100cc来绕过PENDING_CONTRACT。 |
| condition-field-op-combination-invalid | 已知字段和运算符也只能按获批组合使用：score接受gte number，不接受eq string。 |
| minimal-revoke-after-window-valid | 已知记录最小revoke不带data/旧consent，不受upsert/correct的原事实窗口限制；仍需真实鉴权、绑定和有序head。 |

当前资格来源只支持GCA、FS；GPTi、100cc、shcw2027保持PENDING_CONTRACT。已有task3的source枚举拒绝检查未重复计为新增测试。资格协议仍是cp-governance/1 rev1.2；app-outcome/1私密归档不能扩大为奖励资格。

## 执行

使用项目现有Node（本轮Node24）和已安装依赖，无下载或联网：

```sh
node --test tests/governance-message-fixtures.test.mjs
```

`validate.mjs`仅文档示例预检，不属于生产API/消费者，也不导出机器鉴权通道。正例只说明消息与虚构元数据一致，真实CP还可能拒绝。

## 与已通过检查的区别

task3 `governance-adapter/test.mjs` 的18项主要验证入场快照、binding命令/回执、三来源PENDING_CONTRACT及来源枚举；`governance-qa/admission/ADMISSION-FINAL-QA.json`另有20组本地入场QA，明确不测试CP canonical奖励/资格传输。本例新增资格消息与CP上下文关系、历史时间边界和每来源版本组合。已有21项DB服务测试是运行时证据；本例不替代或重跑它们，不重复声称“奖励引擎已新增验收”。

具体对照见 [COVERAGE.md](COVERAGE.md)。新网页、自动消费及第三迁移仍未应用；这些文件不改变该状态。
