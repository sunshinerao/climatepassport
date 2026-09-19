# Climate Passport 功能需求 V1

状态：历史V1与既有需求编号基线；下一阶段以 [功能开发需求V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md) 为执行入口。原CP-FR编号继续保留，三层职责、programme授权、私密协作/发表和交付依赖按V2细化；下文旧阶段顺序不再作为所有项目共同的串行上线前提。  
语言：首发仅 `zh`、`en`；新增其他语言须经产品与运营负责人批准。  
权威顺序：本文件定义 V1 可执行功能范围；与架构、ID/QR、渠道、证书专题冲突时，以 `README.md` 的 Current Authority 顺序及专题安全规则为准。

## 2026-09-18 验收细化

本文件的 CP-FR 编号继续有效。新增执行约束见 [开发要求和计划第2节](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md#2-可执行需求补充)，当前缺口见 [差异审查](REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md)。验收标准中的“代码层完成”不能代替对全部兼容入口的实测；尤其旧 Activity 签到、参与更新和申请导出仍存在资源边界缺口。

- CP-FR-004/005/010/020~023：全入口资源授权、session操作者、合法参与资格、原子核销、稳定主体限流；不能只修统一scanner。
- CP-FR-011/012：已有LE写回应补并发、失败恢复和幂等验收，不从零重建；夏校保持独立冻结。
- CP-FR-030~033：申请与已签发状态分离；签发快照和核验所印内容一致；真实PDF、中文文件名、成功附件计数、可靠审计；匿名扫码不能获得私有产物或额外隐私。
- CP-FR-003：公开档案以同意驱动的令牌链接为准，不恢复UUID/Passport ID公开查询。
- CP-FR-040/041：八模块真实动作、共享壳、原型字体/间距逐项验收、320/390/768/1440px和窄屏三线菜单；关键E2E不得因缺登录fixture而skip。

当前本地测试快照为330项通过（2026-09-18此前检查），并非全面浏览器或生产验收。各工作包完成须记录环境、结果、skip、截图及未解决风险。

## 1. 定位、目标与边界

Climate Passport 是气候身份、可信参与、学习成果与可验证凭证的 Core Platform 及系统记录源，不是普通活动网站、通用 CMS、单一 LMS 或单一证书工具。

SHCW 是 Channel Shell：拥有 CMS 内容、新闻、议程及活动页面展示、嘉宾展示、媒体中心、合作伙伴展示和 SHCW 品牌；不得拥有或重建 Core 的账户、身份、Passport ID、报名、学习申请、签到、QR、核验、证书、积分、成就、里程碑或参与记录状态。Shell 只能通过 Core API、SDK 或嵌入/跳转的 Core 流程接入。

### 已验证档案（Phase 3A，本地实现）

档案在请求时仅从当前已核验 Core 记录推导，展示五个固定维度、规则版本、证据数量/档位和可解释纳入原因；没有 0–100 或 AI 推断评分。默认私有，用户以字段白名单和政策版本确认创建可撤销、过期和访问次数受限的匿名令牌链接。不得以 UUID、Passport ID 或邮箱查找公开档案。LMS provider/apply、任务、招聘/匹配、AI、DID/VC、通用证据上传及批量导出不在本阶段。

V1 目标与度量：

| 目标 | 发布后度量 | 口径 |
| --- | --- | --- |
| 建立可信身份 | 100% 已激活用户有唯一 Passport ID | 不含内部数据库 ID |
| 完成参与闭环 | 已核销签到均产生可追溯参与记录 | 报名、权限与活动上下文均有效 |
| 完成可验证凭证闭环 | 已签发证书可公开验证、撤销后即时失效 | 核验页面仅最小必要披露 |
| 支持渠道复用 | SHCW 核心交易 0 个自建业务状态 | 以 API、SDK 或嵌入流程完成 |
| 保持运营可追责 | 100% 签到、核验、签发、撤销写入审计记录 | 包含操作者/结果/时间/上下文 |

## 2. 用户与范围

活动证书自动签发当前仅为代码及本地迁移 `20260913030000_activity_checkin_certificate_issuance`：仅权威统一扫描器 `POST /api/verifier/scan` 成功 `ACTIVITY_CHECKIN` 可触发。旧 Event、直接 Activity 签到路由、通用规则、后台任务、邮件、PDF、对象存储及生产部署均不在本增量范围。

证书新产物为可打印 HTML（非真实 PDF），通过私有本地或通用认证 HTTP 存储及授权应用端点交付。`20260913040000_certificate_artifact_storage_phase1` 仅已在本地应用；生产卷/HTTP 适配器配置、保留策略、旧内联产物迁移与 PDF 渲染仍待完成。

| 角色 | 主要任务 | 权限边界 |
| --- | --- | --- |
| 个人用户 | 注册、维护资料、报名、申请、出示 QR、查看记录和证书 | 仅管理本人资料与授权公开内容 |
| 活动经理 | 管理被分配活动、报名与现场运营 | 仅限被授权活动；可访问获准的 Activity Center 列表/创建、申请、参与、签到/扫码、任务、提交与评审，不得管理奖励规则、证书规则、表单模板或全局主办方 |
| 核验员 | 扫码并执行签到/核验 | 仅限被授权活动与核验动作；使用 `/{locale}/verifier`，不得进入 `/{locale}/admin/**` |
| 管理员 | 配置运营数据、证书与规则，处理异常 | 受角色授权并留审计 |
| SHCW/合作渠道 | 展示品牌内容、发起 Core 流程 | 不保存或判定 Core 业务状态 |
| 公开核验方 | 验证证书真伪 | 无登录，仅见最小必要披露 |

V1 范围：身份与账户、活动参与、Learning Experience、QR/核验、积分/成就/里程碑、Certificate Hub、运营后台、SHCW 渠道接入。

V1默认发布非目标：区块链或 DID；外部 LMS 完成态自动应用；通用社区、职位、商店/履约；高影响 AI 决策或匹配；离线 QR 认证；SHCW 或任一渠道重建 Core。工作树已有边界受限的外部学习收件、活动社区、内部兑换记账、默认关闭的管理员AI草稿代码，不等于上述完整产品已发布；应按各专题边界验证，不得扩大页面、文案或上线承诺。

## 3. 需求与验收

### 3.1 身份与账户

| ID | 需求 | 验收标准 |
| --- | --- | --- |
| CP-FR-001 | 用户可用邮箱/密码注册、登录、退出并维护会话。 | 合法凭证可进入本人工作台；退出后受保护页面不可访问；失败登录不泄露账户信息。 |
| CP-FR-002 | 每个用户拥有一个稳定、全局唯一 Passport ID。 | 格式为 `XXXXXXX-XXXXXX`；13 位随机大写 Crockford Base32，排除 `I/L/O/U`；不编码年份、渠道、序号、国家、来源或个人信息；内部 UUID/CUID 不对外暴露。 |
| CP-FR-003 | 用户可维护个人资料和公开凭证可见性。 | 本人可更新允许字段；仅用户明确公开的证书出现在公开资料；私有资料与记录不外泄。 |
| CP-FR-004 | 支持角色与渠道会话交接。 | 管理员、活动经理、核验员按授权访问；桥接令牌短时、一次性、仅以哈希形式存储且 targetPath 白名单校验；重放尝试留痕。 |
| CP-FR-005 | 关键写入操作须有可配置的限流保护。 | 账户、桥接、QR 签发、核验及邀请/特别通行证写入使用共享感知限流；通过 `RATE_LIMIT_MODE` 配置模式，代理头仅在 `RATE_LIMIT_TRUST_PROXY` 明确启用时使用；共享 REST 后端使用 `RATE_LIMIT_REST_URL` 和 `RATE_LIMIT_REST_TOKEN`。生产部署及配置验证仍待完成。 |

### 3.2 活动与学习

| ID | 需求 | 验收标准 |
| --- | --- | --- |
| CP-FR-010 | Core 管理活动报名、审批、签到、出席与参与记录。 | Shell 的报名入口调用 Core；仅符合报名/审批/活动规则的用户可签到；结果写入参与记录。 |
| CP-FR-011 | Learning Experience 是独立 Program/Application 域。 | 支持申请、审核、录取、参与、完成和结果记录；不得以活动报名替代学习申请；可关联仪式/公开场次活动。 |
| CP-FR-012 | 已验证行为可按 Core 规则写入积分、成就和里程碑。 | 写入有来源、时间与幂等保护；用户可查看汇总与记录；规则未配置时不得伪造奖励。 |

### 3.3 QR 与核验

| ID | 需求 | 验收标准 |
| --- | --- | --- |
| CP-FR-020 | 支持身份、活动签到、证书核验、邀请/特殊通行证四类 QR。 | 每类有类型、版本、失效和核验规则；QR 不含明文个人信息、原始 JSON、邮箱、电话或内部 ID。 |
| CP-FR-021 | Core 是 QR 解码与判定唯一真源。 | Shell 不得本地信任解码结果或决定核验权限；服务端校验 token、状态、失效、撤销、上下文和授权后返回受限结果。 |
| CP-FR-022 | 活动签到 QR 使用短时、不透明 token 并绑定活动。 | 错活动、过期、已签到、未报名、未审批、撤销和无权限均返回明确受限状态；成功仅记一次签到并写审计。 |
| CP-FR-023 | 核验员权限按身份和活动范围控制。 | 显式 `ActivityVerifier` 分配与活动组织者所有权均在代码层完成授权边界；未分配核验员不能操作；每次成功及失败扫描记录核验员、对象引用、QR 类型、结果、时间、渠道和必要元数据。Activity 邀请/特别通行证 QR 仍未实现，生产部署/E2E 验证待完成。 |

### 3.4 奖励与证书

| ID | 需求 | 验收标准 |
| --- | --- | --- |
| CP-FR-030 | Certificate Hub 是 Core 生命周期模块。 | 证书关联 Passport 身份，可关联活动、Learning Experience、角色、积分、成就或里程碑；Shell 不得独立签发、撤销或存储生命周期状态。 |
| CP-FR-031 | 用户可查看、下载、分享已授权证书，并控制公开展示。 | 仅所有者或授权管理员可下载；下载行为计数并审计；证书详情展示可信元数据与核验入口。 |
| CP-FR-032 | 公开证书核验无需登录且可撤销。 | 仅显示状态、证书名称、证书所印姓名、脱敏 Passport ID（如适用）、签发方、签发/到期日、类型、关联项目/活动、证书编号和核验时间；不得显示邮箱、电话、证件、出生日期、申请材料、内部 ID、管理员备注、完整资料或私有记录。 |
| CP-FR-033 | 证书状态覆盖签发、待审、过期、撤销、草稿。 | 已撤销或过期的公开核验明确显示对应状态；撤销、恢复、重新生成和签发均有授权与审计。 |

### 3.5 后台与渠道

| ID | 需求 | 验收标准 |
| --- | --- | --- |
| CP-FR-040 | 后台使用共享运营壳和角色可见导航。 | 所有 `/zh/admin/**`、`/en/admin/**` 由 `app/[locale]/admin/layout.tsx` 的同一壳承载且无嵌套壳；当前主模块和二级项高亮；Certificate Hub 二级顺序为 overview、records、issue、applications、categories、templates、rules、audit logs。 |
| CP-FR-041 | 管理员可运营用户、活动、Learning Experience、核验员、证书和审计。 | 敏感动作有角色校验、确认与审计；活动经理仅见其获准 Activity Center 运营功能，不可管理奖励/证书规则、表单模板或全局主办方；Certificate Hub 和成就/徽章审核当前仅管理员可操作；核验员使用外部 verifier console 而非后台。 |
| CP-FR-042 | SHCW 可展示内容并复用 Core 交易流程。 | Shell 可展示议程、活动、嘉宾和品牌内容；报名、申请、核验和证书 CTA 进入或调用 Core；不得直接写积分、成就、里程碑或参与记录。 |

### 3.6 活动 AI 文案草稿（Phase 4，本地代码）

| ID | 需求 | 验收标准 |
| --- | --- | --- |
| CP-FR-043 | 仅管理员可为精确活动和 zh/en 请求受人审的 SUMMARY、HIGHLIGHTS 或 OVERVIEW_COPY 草稿。 | 默认禁用；仅允许配置的单一 provider；不接受客户端 prompt/input；草稿生成绝不自动改变或发布 Activity。 |
| CP-FR-044 | 发布必须由管理员编辑（可选）、批准及明确确认。 | 仅 APPROVED 草稿可事务性发布；zh/en highlights 分别写入 `highlights`/`highlightsEn`；审计只保留动作和通用计数，不保留 prompt、原始输出、provider 错误、密钥或个人数据。 |

此本地增量不是聊天、RAG、匹配、评分、推荐、审核决定、画像、上传或浏览能力；不使用申请人、参与、嘉宾、议程、社区、证书、档案或 ID 数据。生产 provider 配置、隐私/安全审查和部署仍为外部上线门槛。

## 4. 关键工作流

1. 身份与报名：用户注册/登录 -> Core 分配或读取 Passport ID -> Shell 或 Core 展示活动 -> Core 报名/审批 -> 用户在工作台查看状态。
2. 现场签到：用户生成活动 QR -> 核验员扫描 -> Core 校验 token、活动、报名与核验员范围 -> 写签到/参与/审计 -> 按规则触发奖励或证书候选。
3. 学习完成：用户申请 -> 审核/录取 -> 参与与完成确认 -> Core 写入完成结果 -> 按规则写积分、里程碑、成就及证书。
4. 证书核验：签发/发布证书 -> 生成含不透明核验码的 QR 或链接 -> 第三方访问当前应用的公开核验路由（独立核验域名须先批准配置） -> Core 校验状态 -> 最小披露并记核验日志。
5. 渠道交接：SHCW 展示内容 -> 用户点击 Core 交易 -> 通过 API、SDK 或嵌入流程传递受限渠道上下文 -> Core 执行与保存状态 -> Shell 读取获授权状态展示。

## 5. 非功能需求

| 类别 | 要求 |
| --- | --- |
| 安全与隐私 | HTTPS；HTTP-only 会话；密码安全存储；不透明 QR；服务端真源；令牌失效/撤销；最小必要披露；密钥不得进入 Shell。 |
| 授权与审计 | 所有后台、核验和下载动作执行角色与资源范围校验；关键成功/失败操作可追溯。 |
| 可靠性 | 报名、签到、奖励和签发须幂等；冲突与重复请求不得产生重复参与、积分或证书。 |
| 可用性 | 首发所有用户/后台/核验关键流提供 `zh`、`en`；桌面和移动端完成关键任务；错误状态可理解且可恢复。 |
| 集成 | API 合约版本化；渠道只接收已授权字段；桥接、QR 和核验接口限流并监测异常。 |
| 数据连续性 | 保留已接受的身份、ID、时间戳、签到、参与、积分、邀请/通行证和证书历史；安全、隐私和 Core/Shell 决策优先于旧流程。 |

## 6. 当前能力与剩余交付计划

### 6.1 已有基础

- 身份、邮箱验证/重置、会话、角色、Passport ID、活动/学习申请、基础 QR 与核验、积分/徽章/成就、证书签发/下载/撤销/公开核验均已有第一版实现。
- 渠道桥接令牌已短时化、哈希存储、目标路径白名单化，并已实现原子消费与重放审计。
- Phase 0 Core API 运行时回归测试包已覆盖 auth、channel bridge（v1/unversioned）、QR/verifier、证书生命周期/产物授权/公开最小披露、参数化 admin RBAC；本地 `npm test` 通过 **324** 项测试。该回归使用模块 mock 在 Node 中执行路由，仅验证运行时行为与授权边界，不替代已部署浏览器 E2E、生产配置或真实外部依赖验证。
- 以上仅表示本地功能基础存在，不构成生产上线证明；生产配置、数据、监控和端到端回归仍须按下列阶段验收。

### 6.2 从当前状态开始的交付顺序

| 阶段 | 依赖 | 剩余可交付物 | 完成门槛 |
| --- | --- | --- | --- |
| Phase 0: 上线安全与可信闭环 | 无 | 旧密码迁移/强制重置后仅允许 bcrypt；共享且代理可信的限流；Event-only 邀请/特殊通行证不透明单次 QR（Activity 核验授权已修复，但 Activity 版本尚未实现）；QR 轮换/撤销策略；Event/Activity 归属边界；关键 API/E2E 回归与运行手册 | 认证、桥接、QR、核验、证书写操作均受生产级保护；核心流程在 zh/en 自动化通过；可回滚、可排障。 |
| Phase 1: 凭证和运营产品化 | Phase 0 | 统一后台壳；证书记录、批量签发、分类、模板、恢复、通知、审计；渲染与对象存储；迁移校验报告 | 授权运营人员不依赖数据库即可完成凭证生命周期；产物可授权访问、可恢复、可追溯。 |
| Phase 2: 渠道与学习证据接入 | Phase 0；首个合作方/供应商决策 | 版本化 Core 合约、SDK、一个 SHCW 真实旅程；LMS 账号映射、签名 webhook、幂等、对账队列和完成回写 | Shell 不复制 Core 状态；外部完成事件只写入一次且可人工对账。 |
| Phase 3: 能力档案与合作 | Phase 1、2；隐私与治理批准 | Person/Institution 主数据；五维能力规则与可解释页面；授权分享/导出；受控合作试点 | 每项能力结论可追溯到已验证证据和规则版本；合作方访问可撤销且被审计。 |
| Phase 4: 社区、兑换、AI 与互操作 | Phase 3；对应商业/法务/运营决策 | 受审核社区；第三方商城兑换；人审优先 AI 辅助；可选 VC/DID/链上互操作试点 | 每项集成都有数据责任、幂等、监控、风控和事件响应；不发布未经治理的高影响自动决策。 |

## 7. 工单规则与领导决策

工单规则：每项工单必须引用至少一个 `CP-FR-*`、标明所属阶段和依赖、定义 zh/en 验收、列出权限/隐私/审计影响及测试证据；涉及 Core 状态必须指定 Core 服务/API 合约，禁止在 Shell 新建同类状态；未决事项标记 `blocked`，不以假实现关闭；完成后同步实现状态与 pending tracker。涉及外部系统必须额外写明事件 ID、签名验证、重放保护、幂等键、失败重试、人工对账和责任人。

协作规则：PM 负责需求澄清、优先级、依赖、验收标准、风险台账和发布决策；`coder` 仅在明确工单范围内实施、补充测试并报告结果。每个实现任务必须先检查现有页面、组件、样式边界和对应原型，复用现有设计令牌、布局、组件与交互模式。未经 PM 明确批准，不得引入新的视觉语言、颜色体系、字体体系、组件库、页面壳或与现有产品定位不一致的装饰风格。任何 UI 变更必须验证桌面与移动端，且不得破坏既有已验收页面。

领导已决：

| 决策 | 执行含义 |
| --- | --- |
| Core 优先 | Climate Passport 是唯一系统记录源；SHCW 是 Shell。 |
| 信任闭环优先 | 身份 -> 已验证行为 -> 可追溯记录/奖励 -> 可验证证书先于扩展功能。 |
| QR 隐私优先 | 默认不透明 token、服务端校验；当前不做离线认证。 |
| 核验在 Core | 当前不是独立 verifier app，但必须提供独立 API 能力。 |
| 最小披露 | 公共核验验证凭证，不暴露个人。 |
| 首发语言 | 仅 `zh`、`en`；其余语言不纳入 V1 上线承诺。 |

## 8. 上线就绪

上线前必须全部满足：

- `zh`、`en` 的注册、登录、工作台、报名、签到、Learning Experience、证书与核验关键文案/路由可用。
- Passport ID、QR payload 与公开核验无个人明文、内部 ID 或渠道/序号泄露。
- 核验员、活动经理、管理员及用户的越权测试通过；公开核验最小披露测试通过。
- 注册 -> 报名 -> 签到 -> 参与记录，以及签发 -> 下载 -> 核验 -> 撤销的端到端回归通过。
- 审计日志可查询关键成功/失败事件；桥接与核验接口具备限流、重放记录和异常监测。
- SHCW 仅以 API、SDK 或嵌入流程接入，且不存在其自有 Core 业务状态。
- 数据迁移/连续性校验通过，发布回滚、运营负责人和事件现场支持方案明确。

## 9. 规范引用

- `CURRENT_PRODUCT_REQUIREMENTS.md`
- `CURRENT_ARCHITECTURE_DECISIONS.md`
- `PASSPORT_ID_AND_QR_SPEC.md`
- `CHANNEL_SHELL_INTEGRATION_SPEC.md`
- `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`
- `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
# Certificate lifecycle safety addendum

Certificate category keys are immutable. A category cannot deactivate while active templates or definitions depend on it, and it cannot be deleted while any template or definition exists. Active issuance requires active category, template, and definition. Issued rendering is regenerated from the persisted snapshot rather than mutable live configuration; legacy issues without a valid snapshot require reissue.

## Certificate Application Phase 1 addendum

用户证书申请是独立领域状态，不得复用 `CertificateIssue` 状态。仅允许申请启用的 definition/template/category 且 category 开启 `userRequestEnabled`；申请人只可查看和操作本人申请。管理员可要求补充、拒绝或批准并签发；补充/拒绝必须有申请人可见说明。批准必须原子地创建唯一、可追溯到申请的证书、状态事件、审计及站内通知。此为代码及本地迁移范围，不包含附件、外部邮件、后台任务、自动规则或生产发布。
# Controlled PROJECT application requirement update (2026-09-13)

PROJECT applications are a consent-controlled subset of ActivityApplication: authenticated applicants submit/withdraw only their own records; each submission records `PROJECT_APPLICATION_CONSENT_V1` and selected disclosure fields. Review is limited to ADMIN or exact organizer ownership, with APPROVED/REJECTED/WAITLISTED transitions and idempotent participation on approval. Reviewer data is scoped to consent; it excludes raw user IDs, Passport IDs, unconsented profile data, and portfolio tokens. All state-changing and reviewer-view actions are audited and notify only applicant/owner in-app using non-PII bodies. This local migration/workflow excludes interest-only submission, teams, jobs, recruitment/search, matching, AI, institution browsing, and public directories.
