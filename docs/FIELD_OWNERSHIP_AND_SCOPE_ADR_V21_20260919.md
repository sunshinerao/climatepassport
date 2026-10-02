# 字段所有权与多 Programme Scope 接入 ADR（V2.1）

日期：2026-09-19
状态：已批准（V2.1 边界修订框架下）；本文是 CP-TODO-240 的交付物
关联：CP-FR-050/051/052/053/069/071/073；CP-TODO-241~245；[功能需求 V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md) §2/§3/§6

## 1. 背景与问题

Climate Passport（CP）从单一 SHCW channel 演进为面向多个 Programme 的可复用数字基座。V2.1 边界修订确认：Programme 业务层（Future Stewards 的 Call/Lab/课题/导师/编辑系统、SHCW 的举办申报与年度运营、Convener 的席位/激活/任务书/支持工单/Credit/Standing）由各 Programme 独立开发、维护并对接 CP，**不属于 CP 的开发交付**。若不在 CP 侧先冻结字段所有权与 scope 契约，直接接入新 Programme 会造成：全局角色扩权、业务表复制、字段权威冲突、跨 Programme 数据泄漏。

本 ADR 冻结三件事：字段所有权划分、scoped contract 模型、复用与排除原则。CP-TODO-241 起的代码实现以本文为基准。

## 2. 决策 1：字段所有权

原则（与 V2 §2「三层职责及单一写入方」一致）：**CP 内同一事实只保留一个权威记录**；外部对象只允许映射稳定 `sourceRef/schema/version` 及必要结果，不在 CP 建业务表。

| 字段类别 | 权威系统 | CP 的处置 |
| --- | --- | --- |
| 账户、Passport ID、会话、凭证、密码 | CP | CP 唯一权威；Programme 不复制账户体系，只经认证/授权契约引用 |
| Person / Institution 主档 | CP | CP 权威；Programme 提供来源引用与认领/更正申请；私有来源快照不自动覆盖主档 |
| 范围授权、同意、对象级分享 | CP | CP 权威（AccessMembership / ObjectAuthorization / 同意服务）；业务会员、席位、年度资格**不**进入该表、不自动放宽旧接口 |
| CP 承载的通用参与事务（报名/容量/核验/签到） | CP | CP 权威；Programme 只送有范围、版本和有效期的资格决定 |
| Programme 业务字段（课题、席位、任务、工单、Credit、排班、评审意见等） | 各 Programme | CP 不建表、不存储正文；只接稳定外部引用、schema 版本和最小决定回执 |
| 来源活动字段（标题、议程、发布状态等） | 来源 Programme 系统 | 经 SourceObjectMapping 登记来源版本与权威字段白名单；CP 侧副本为受控投影，**CP 不得编辑覆盖源权威字段，来源也不得覆盖 CP 签到/参与状态** |
| 证书、核验白名单、长期行动记录 | CP | CP 权威；外部 approved 不等于 CP 能力核验，不自动转换 |
| 技术运维可见性 | CP 治理 | CP 技术运维无常态正文浏览或默认业务审批；紧急访问须限时批准并审计（CP-FR-051） |

来源方字段所有权以 `SourceObjectMapping.authoritativeFieldsJson` 白名单形式登记；任何同步只允许白名单内字段，且只能由登记来源系统写入。

## 3. 决策 2：Scoped Contract 模型

新增范围与授权模型（全部 additive，见 `prisma/schema.prisma` 与迁移 `20260919060000_multi_programme_scope_foundation`）：

| 模型 | 职责 | 关键约束 |
| --- | --- | --- |
| Tenant | 管理隔离范围 | 不等于 Institution；不做权限继承 |
| Programme | 业务范围 | 一 Programme 1..n Edition；不得复用 LE Program 作租户 |
| Edition | 年度/期次范围 | 属唯一 Programme；跨 Edition 访问默认拒绝 |
| AccessMembership | user × programme × edition(可空=全 Programme) × scoped role | 仅表示 CP 服务访问授权，不表示业务资格；兼容 UserRole 但全局角色不自动跨 Programme |
| ObjectAuthorization | 对象级授权（subject × objectType/objectId × action × purpose × 有效期 × 撤销） | 逐对象授权；撤权立即生效 |
| InstitutionRepresentation | 人员代表机构 | **组织员工/任职（PersonAffiliation）不自动代表机构**；须显式委托，有期限与动作范围 |
| ChannelClient | 客户端登记（machine identity / scoped contract / 双 origin allowlist） | service secret 不进浏览器；未知客户端拒绝（字面量见决策 4） |
| SourceObjectMapping | sourceSystem + sourceEditionRef + sourceObjectId 唯一 → CP 对象 | 并发首次接入只一条；来源版本与权威字段白名单随映射保存 |

授权判定（`apps/passport-web/lib/server/programme-scope.ts`）：默认拒绝；未知 scope 拒绝；scope 中 programme/edition 不一致（edition 不属于 programme）拒绝；跨 Programme、跨 Edition 读写拒绝；过期/撤销的授权拒绝；全局 `UserRole`（含 ADMIN）**不**自动获得 Programme 范围访问。

## 4. 决策 3：复用与排除原则

1. **复用不复制**：不同 Programme 复用底座，不复制 CP 拥有的账户、凭证和已选择由 CP 承载的交易；CP 已承载的报名/LE 申请/证书申请继续保留，不按名称一刀切。
2. **契约接入**：新 Programme 遵循既定契约（Identity/Scope、MasterData、SourceActivity、ScopedRecord、Delivery 等契约族）时，无须新增其专属 CP 模块、页面、表或品牌条件分支；确需新共用能力时先独立评审复用价值。
3. **CP 配置边界**：CP 配置仅控制客户端、scope、字段白名单、资源限制、通用凭证/参与规则和平台安全；**不得用 Programme 配置包、插件或通用工作流引擎绕回承载个性化业务**。
4. **明确排除（不在 CP 交付）**：Programme 业务规则包、专属业务工作区/菜单、席位/年度激活状态机、支持工单、Credit/Standing 计算（CP-TODO-254/255/256 已标 `external`）；CP 不开发、不运行、不以配置名义承载。
5. **技术运维边界**：CP 技术运维无常态正文浏览或默认业务审批；紧急访问走限时批准并留审计（与 CP-FR-051 一致）。

## 5. 状态与后续

- 本 ADR 冻结后实施顺序：CP-TODO-241（scope 基座与授权服务）→ 242（Person 认领与机构代表服务化）→ 243（channel 用户/机器认证与环境）→ 244（outbox/inbox）→ 245（来源活动映射执行层）。
- 验收基准：至少三个虚构 Programme、两个 Edition 的真实数据库越权矩阵（正/反/撤权/全局角色/未知 scope）通过后才可视为 241 完成。
- 夏校冻结不受影响：全部模型 additive、可空，既有 Activity/Event/LE 在无 scope 映射时行为不变。
