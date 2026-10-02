# 覆盖对照（不是重新计算task3成绩）

只读检查来源：task3/governance-adapter/test.mjs与test-results.json（18项），task3/governance-qa/admission/ADMISSION-FINAL-QA.json（20组），CP tests/governance-conditions.test.mjs（4项），CP tests/api/governance.test.ts（21项DB服务验收）。这些既有结果不在此重新执行。

| 已有覆盖 | 本轮增量证据 | 不重复声称 |
|---|---|---|
| 本地entry冻结、重复入场、错误reply pin | 缺少binding ruleVersionId；首个qualification企图换rule | 不重测入场网页、fixture authority或绑定回执 |
| 两来源reply共用participationId | 两来源完整资格v1消息、各自stream key及禁止跨来源supersedes | 不重建canonical奖励引擎，不宣称发奖 |
| 本地retire保留entry、CP DB历史correct正例 | 传送时间与事实时间分离、validUntil排他、事实早于入场反例 | 不重测旧站retire网页或DB |
| adapter来源枚举拒绝GPTi/100cc/SHCW | 资格事件顶层sourceApp伪扩展被实际严格schema拒绝，GCA套FS事实的上下文反例 | 不重复三个source枚举检查，也不增加枚举 |
| CP typed condition未知字段/op/NaN/脚本拒绝 | 已知field/op错误组合 score+eq+string | 不重复脚本与未知字段反例 |
| CP DB重复消息并发唯一 | 文档化JSON键顺序稳定重送、同ID改body、新ID占旧version | 不把纯内存预检等同DB并发证明 |
| canonical设计与DB单元唯一性 | Programme ID错作project引用、同Programme两个具体期次引用不同 | 不在shape schema新增Programme粒度字段，不推断真实mapping |

19条完整JSON样例 + 3项组合关系测试 = 22项离线文档测试。正例是每个负例的必要对照，并非重新计数已完成的18项绑定检查。每项永远不受理资格、不产生奖励；所有ctx均为惰性虚构值。
