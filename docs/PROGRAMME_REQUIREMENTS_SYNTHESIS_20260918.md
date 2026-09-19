# 三个 Programme 的需求提炼与兼容分析

日期：2026-09-18。用途：说明三个项目输入如何转化为 Climate Passport 共用能力、项目配置与排除项。下一阶段执行基准为 [功能开发需求 V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md)，不是把三份来源逐条照搬成三个系统。

**用户确认后的边界修订：各programme自主开发业务层，CP只开发数字基座共享能力与接口。** 这优先于来源文件“可托管CP项目模块”的建议和本报告最初的宽范围提炼。下文专属业务需求保留来源追踪，但不进入CP开发；CP-FR-063/064/065、CP-TODO-254/255/256已转external，FS工作区/评审等只保留CP侧通用服务需求。

## 1. 阅读范围与证据

完整读取以下三个文件，其中 Word 文件提取了正文与所有表格；本次不修改来源文件，也不将来源中的拟议制度或示例接口当成已批准政策/现有 API。

| 来源代号 | 文档及定位 | 版本与证据 |
| --- | --- | --- |
| FS | [Future Stewards 数字底座边界与功能说明](../ref_docx/Future_Stewards_Climate_Passport_边界与功能说明_v1.0.docx) | v1.0，2026-09-18；正文第01~12节、FR01~09、AT01~13；DOCX正文103个顶层块，含表格 |
| SH | [SHCW 2027 所需 CP 能力](../ref_docx/SHCW2027_所需ClimatePassport能力_V1.0.md) | V1.0，2026-09-18；CP-SHCW-001~012、IC-01~10、CP-AC-01~18 |
| CV | [百人荟主理人运行与 CP 开发边界](../ref_docx/SHCW_Convener_Operating_and_CP_Development_Guide_v0.1.md) | v0.1，2026-09-18，内部建议稿；第1~12节，12项验收 |

读取时 SHA-256：

```text
FS cc0e459f683a9a3e62511dadb6c6d7e119e6ce00a18b6e2f21c1f1ef9d979088
SH dc11ece48a8c4ae97aaff7bda58b6691794860f6f388972ad79618cf0700225b
CV 6f19d88a1daf8994daff40fb66118de8d7ae8f3afc997c73c20be9133afdd4e0
```

SH引用的另一份网站开发需求、CV引用的综合制度/信用讨论稿、FS引用的概念/知识系统材料未包含在本目录，不能推定已阅读或批准。仅以这三份实收文件为本次需求输入。品牌按新FS文件的“赞助与数字支持”语境处理，不让技术依赖变成课程主导、青年数据权或商业使用许可。

代码核对范围：`prisma/schema.prisma`、auth/渠道契约与SDK、Activity申请/任务/投稿/参与、Person/Institution、Portfolio、证书、已知安全差异文档。本次是需求与静态实现对照，未重跑运行测试、生产探针或跨站联调；之前330项测试不能证明新需求已实现。

## 2. 三个需求不是三套产品复制

| Programme | 用户真正要完成的事 | 专有规则保留在哪里 | CP要提供的共用能力 |
| --- | --- | --- | --- |
| Future Stewards | 响应号召或自主探究，私密记录、证据、导师反馈、修订，自愿发表/撤回 | FS自主开发Call/Lab/七步法、课题/任务、导师/投稿/编辑/展示系统及页面 | 身份/scope、通用私密记录和不可变资产版本、对象分享、外部决定回执、同意/公开访问网关、长期记录 |
| SHCW 2027 | 身份接入与主档引用；正式活动两站一致；报名/入场/实际贡献可追溯 | SHCW私有年度运营：举办申报、Speaker/Venue/Volunteer申请与评审、邀约协商、筹备排期及Programme编辑 | 人物/机构及代表权、来源映射、版本化活动投影、参与事务、核验、个人和机构行动证据、汇总、对账 |
| 百人荟主理人 | 年度激活、Offer-Need、双向任务、支持跟进、季度复盘、贡献复核 | 主理人团队自主开发席位/激活、分类、任务书/工单、Credit/Standing/续期和工作台 | 主体/访问授权/代表、通用活动/证据、最小外部结果接入及可选凭证；不开发其运营和评价系统 |

共同结论：CP是可复用的数字基础底座，不是项目业务承包方或业务模块容器。各programme独立开发维护业务系统及模型，通过API/SDK/事件接入；共用基础设施不允许混合领域模型或直接写CP数据库。跨项目复用身份不等于共享私人数据。

## 3. 归一化及冲突裁决

| 差异/冲突 | 本次归一化决定 | 不能由此推导 |
| --- | --- | --- |
| 旧Core/Shell两层及来源中允许CP托管业务 | 按用户最新确认：CP共享层与外部自主开发的业务/体验层分开；CP不开发专属模块 | 所有Application都归CP，或用配置/托管绕回混合开发 |
| CV写CP-加12位随机字符，与当前无前缀13位规格冲突 | 保留现行 `XXXXXXX-XXXXXX`，无年份/渠道前缀，不重发旧ID；CV该段不采纳 | 修改用户身份、用ID当凭证、给机构未经设计套个人Passport ID |
| FS Programme、城市Milestone、Call、Lab和CP LE Program/Activity | Programme是业务/权限范围；城市节点是展示节点；Call与Lab多对多；可关联LE/Activity但不等同；名称冲突用类型区分 | 一切塞Activity或LearningExperienceProgram；城市日期自动生成个人完成里程碑 |
| FS自主Inquiry可无Call；现有ActivityTask必绑activityId | FS自建Inquiry，CP提供不强绑Activity的通用私密记录/对象授权 | CP承包课题工作台，或为青年草稿伪造公开Activity |
| 活动发布、录取、出席、贡献、认证 | 独立状态与证据；支持计划/确认/实际/核验层次 | 发布就开放报名、报名就入场、签到就能力认证 |
| FS作者Private/Public与旧Certificate.publicVisible | 作品采用意愿+逐版本审核+发布+用途/频道同意；证书核验与portfolio分享独立 | 一个isPublic控制全部用途；证书核验可公开整份作品 |
| 成员、任职、机构代表、导师、系统ADMIN | 分别建关系与权限；身份或任职不授予业务审批权；运维访问限时审批留痕 | 全局ADMIN可默认看所有青年稿件或批准项目资格 |
| CV Credit/Standing与CP积分/Portfolio维度 | CV独立开发计算/复核/申诉；CP只按用途接最小有版本结果，不混入User.points | CP建立项目评分模块、缴费买Credit、Credit自动带来治理/商业权 |
| FS开放发表与CP最小公开验证 | 正文经作者意愿与审核才可发布；证书只展示核验白名单；频道授权分别检查 | FS公开即许可CP首页推荐、商业宣传、训练AI或无限复用 |
| SH同步建议、CV服务SLA、FS监护等不同政策 | CP负责接口/存储/授权等基础配置；programme自行实现运营SLA/年龄办理/评分政策；各自批准 | 把所有业务规则当CP可配置能力，或虚构法律/服务承诺 |
| FS条件性OIDC建议与现有SHCW bridge | 保留现有已实现契约，另作真实跨域认证ADR；OIDC只是候选，不宣称现有已支持 | 把bridge当通用SSO，或浏览器保存服务密钥 |
| 三个programme使用关系紧密 | programme/channel/tenant分别注册，合作关系不产生跨域继承权限 | 百人荟属于SHCW便默认读所有年度，CFA集合便读所有青年记录 |
| 原计划全证书完成后才做渠道 | 安全门槛共用；按场景的最小闭环发布，未启用证书的SHCW不等待完整PDF | 启用下载PDF却以HTML替代，或新项目绕过既有P0修复 |

## 4. 已有基础与新增缺口

| 代码证据 | 可复用 | 不足与后续要求 |
| --- | --- | --- |
| `packages/passport-core/src/index.ts`、auth | 稳定Passport ID、不透明令牌、现有会话 | 缺多programme授权摘要与真实多渠道上下文认证 |
| `packages/passport-contracts/src/index.ts` | v1 bridge/exchange/verify schemas；`ChannelKeySchema`仅SHCW | 不是FS/CV的工作区、活动发布、证据与对账API；必须新增契约而非声称已支持 |
| `Person`、`Institution`、`PersonAffiliation`、`PersonRoleProfile` | 统一主体与Speaker兼容关联 | 没有完整机构委托/认领、programme/edition授权、监护或合并历史治理；role profile是描述，不是业务权限 |
| `Activity`、`Event`、`ActivityDateSlot` | 正式活动、容量、时区、机构/嘉宾关系 | 未见源系统+年度+源活动唯一映射；日期槽不是独立期次；多个visibility字段须明确归一；不能重复建Event/Activity |
| `ActivityApplication`、`ActivityParticipation` | 单活动用户唯一、申请和参与基本状态 | `roleType`为单字段，不能覆盖同人多项贡献；需容量事务、候补、期次报名、渠道状态契约；不接举办申报 |
| `LearningExperienceProgram/Application/Participation` | 学习申请及完成写回 | 不等于通用scope；Call-Lab/Inquiry/导师业务由FS实现，不作为CP缺失模块；保留原模型和夏校 |
| `ActivityTask`、`ActivitySubmission`、`ActivityReviewWorkflow` | 任务、投稿、审批基础 | ActivitySubmission是可变正文和fileUrls；不是不可变版本、受控Asset、授权发表。任务/投稿API偏ADMIN/EVENT_MANAGER，不能直接给青年/导师开放 |
| `ProjectApplicationConsent`、`PortfolioShareConsent/Link` | 特定申请字段同意、可撤销档案token | 不是逐作品版本/频道/用途/共作者/监护授权；保留专用语义，以新服务扩展，不把现有布尔值扩成无限授权 |
| `Achievement`、`PassportMilestone`、`CertificateIssue` | 长期记录、可信等级与凭证 | 不能代替版本化贡献事实和机构贡献，也不能直接承载CV Credit；只对当前有效、获批准证据形成派生记录 |
| 外部学习inbox、audit、notification | 签名/幂等模式、日志及站内消息 | 没有完整通用outbox/inbox/receipts/失效网关/媒体扫描转码；模式可复用，provider学习收件不能直接当SHCW已核验行动 |
| 既有安全审查 | 已定位权限/签到/导出/限流缺口 | 新programme上线前必须关闭相关全部入口，包括旧兼容路径，不允许只保护新API |

## 5. 来源到统一需求的追踪

以下编号均指V2中增量CP-FR；既有001~044仍有效。063/064/065为外部业务追踪，其余只表示CP共用接口/安全要求；源场景中的业务页面/流程由各programme负责。

| 来源需求 | CP-FR对应 | 处理 |
| --- | --- | --- |
| FS §01~04组织/项目、身份、角色隔离 | 050~052、069 | 共用；业务编辑权归FS |
| FS FR01号召、FR02场景七步、§03多对多 | 055、057、071 | FS开发业务；CP提供外部引用/必要快照、通用参与和记录接口 |
| FS FR03导师内容、FR06投稿审核 | 058~061、071 | 共用发表机制；字幕/来源/许可与版本进入契约 |
| FS FR04自主课题、FR05导师反馈 | 057、059、072 | FS自建课题/导师工作区；CP检查通用记录分享和外部反馈回执 |
| FS FR07发表推荐、FR08节点展示 | 060、061、071 | CP执行有效授权；FS决定策展，不复制作品主稿 |
| FS FR09档案、§09通知统计、§10保留导出AI边界 | 062、066~068、073 | 私密成长与已核验能力分开展示；无AI训练隐含许可 |
| FS §06~08版本并发、撤回、文件、备份 | 058~061、068、070 | 发布前后均验当前授权；撤回先阻断读取，再异步清投影 |
| SH CP-SHCW-001、002、003 | 051、052、069 | 身份、主档、机构代表，复用+补契约 |
| SH CP-SHCW-004、005 | 053、054、060、070 | 唯一源映射、正式关系、版本受控公开 |
| SH CP-SHCW-006、007 | 055、056、066 | CP报名/资格/核验；EXTERNAL/NONE明确不生成报名事实 |
| SH CP-SHCW-008 | 058、062 | 个人/机构行动证据与等级，不把自报当核验 |
| SH CP-SHCW-009 | 051、060、061、068 | 多层用途授权、撤回、事实更正、删除分开 |
| SH CP-SHCW-010 | 050、053、069、070 | channel/edition/机构/对象授权，幂等与对账 |
| SH CP-SHCW-011、012 | 062、063、067、073 | 可选奖励及汇总、环境契约与联合验收 |
| CV §1~3价值路径、四类支持、席位/年度、责任 | 052、064、065 | 外部自主业务，CP只提供主体/代表等必要基础接口 |
| CV §4领域Cluster/Track/系列、参与闭环 | 054~056、065、066 | 分类/期次约束、反馈与会后行动，不重复计数 |
| CV §5~6代表、任务、证据、Credit/Standing | 050~052、057~060、062~065 | 通用记录+项目政策，钱/积分/资格/评价互不等同 |
| CV §7~8可靠接口、隐私、运营审批 | 051、060、068~070 | 可靠同步，利益冲突回避，技术运维不默认业务审批 |
| CV §9~12页面、分期与验收 | 072、073 | 前台示例不当后端完成；一场真实批准活动到后续行动 |

来源测试整组继承：FS AT01~13、SH CP-AC-01~18、CV §10测试1~12均须保留测试ID，见V2验收矩阵。没有通过证据的项目不得标完成。

## 6. 下一阶段取舍

CP先做安全/scope、身份/代表权、通用记录/许可/契约。FS课题发表、SHCW活动、主理人年度支持仅作双方联合验收案例；各方独立交付业务层，CP交付共享API与沙盒。外部业务尚未完成时不能要求CP代建，也不能将案例未就绪误记为CP代码缺失。

不为此建设项目模块容器、专属业务表/菜单、通用BPMN、CRM/LMS或AI评分。容纳不同项目意味着契约可复用、记录兼容且权限隔离，而非接管其业务开发。来源文件不改，夏校保持现状；新programme符合契约时不需新增CP专属模块。
