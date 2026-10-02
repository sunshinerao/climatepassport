# 开发要求与执行计划（2026-09-18）

配套：[差异审查](REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md)、[V1 功能需求](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V1.md)、[总 tracker](CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md)。本文细化验收及剩余工作，不重新宣布旧阶段全部未做，也不覆盖专题隐私规则。

## 三个Programme输入后的顺序修订

当前总需求与新增计划见 [V2及V2.1边界修订](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md) 及 [来源提炼](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md)。218~239的安全、证书、LE/档案及发布任务继续有效；240~259中254/255/256移交programme自主开发，标为external且不计CP进度，其余收窄为共享范围授权、通用记录/证据/访问、机构代表、来源活动和对接。CP不开发项目专属工作区、席位、年度激活、工单、Credit或业务流程引擎。

下文阶段依赖是原证书优先批次，不再要求三个programme先等待完整Certificate Hub才接入。共同前置是218~223安全/测试整改和新scope基础；SHCW正式活动/报名、FS私密学习、主理人活动可按所需能力分别验收。启用证书下载的场景仍必须依赖224~230相关生命周期/PDF测试；FS公开作品必须依赖新的版本同意、公开网关和撤回恢复验收。235/234等既有任务与新增任务共享交付，不重复计数。夏校保持冻结。

## 1. 交付边界

1. 保留当前其他开发者的工作树；先核准基线，不自动提交或推送。发布、生产迁移、供应商启用另行授权。
2. 夏校业务、数据及临时菜单位置冻结；LE 的新完成态和 cohort 工作不接管夏校。公共壳/权限/样式变更须验证夏校没有回归，但不借此调整其产品。
3. zh/en 为本轮必测语言。已有其他语言保留兼容，不承诺本轮扩展。
4. 不重建已有账户、ID、模板、记录、申请、portfolio 和 master-data 模块；针对缺口完善，避免重复模型与旁路。
5. 完成代码、完成本地测试、完成验收、生产可用分别记录。没有证据不能把 todo 改 done；外部依赖只阻断对应工作包，不阻断整个项目。
6. 当前计划“平台 Phase 0~4”是剩余工作的执行顺序；证书 PRD 中原“证书 Phase 1~4”是功能分组，两者不是同一次进度计数。

## 2. 可执行需求补充

### 2.1 权限、核验与数据真源（CP-FR-004/005/010/012/020~023/041）

- 每个资源入口包括列表、详情、导出、批量、旧兼容入口、QR 与 direct mutation，都做服务端角色 + 资源范围 + 合法状态校验。客户端隐藏菜单不是授权。
- ADMIN 按管理动作授权；EVENT_MANAGER 仅获分配/所有权允许的活动；VERIFIER 仅获分配的核验动作；普通用户仅本人允许动作。后台角色不自动获得所有证书隐私数据，扩展字段按记录用途授权；ADMIN 技术运维无常态正文浏览（CP-FR-051），管理动作走后台审计路径。
- 操作者来自有效 session；不接受客户端伪造 verifiedBy、可信积分、证书关联或 passportSynced。签到对象、活动/任务归属、报名/审批资格由服务端重查。
- 同一业务键在并发/重试下只完成一次状态转换、token 消耗、奖励/签发及核心审计。Event 与 Activity 不强行混表；旧入口委托同一规则或明确拒绝，不保留弱校验旁路。
- PROJECT 导出须同时满足资源授权、当前同意/撤回政策及字段白名单；防 CSV 公式注入；不导出内部注释、监护/申请材料等无关敏感数据。
- 限流以稳定账号/认证主体与可信来源分层计数。User-Agent 不得重置主桶；代理头只在明确配置可信代理时使用；共享后端超时/故障及生产缺配置行为可测，敏感接口不得悄悄降级绕过保护。

### 2.2 证书与隐私（CP-FR-030~033）

- 分类、模板、定义、申请、已签发证书是不同实体及状态机。申请 PENDING/NEEDS_INFORMATION 不伪装成已签发证书状态；到期实时判定，恢复不能让已到期凭证变为有效。
- 签发保留可重现快照：所印姓名、标题、编号、签发方、日期、来源、语言、变量、模板版本及渲染配置。修改用户姓名或模板不能悄悄改旧证书；再生成使用快照，必要更正通过显式新签发/替代关系留痕。
- 每张证书独立 opaque verification code/QR。公开验证仅白名单字段，所有者或对该记录获授权的管理者才可看扩展数据；公开可验证不等于可下载、可检索个人全部证书或可看邮箱/内部 ID。
- 公开验证姓名以证书所印姓名为准；页面/API/产物/公开档案共享有效、撤销、过期和不存在判断。日志不持久化原始 token；无效响应不帮助枚举内部 ID。
- 模板表单支持背景、变量、字体/字号/颜色/对齐、物理尺寸/坐标、签名/印章、QR 及说明。先做配置 + 预览，不要求拖拽编辑器。资源类型/大小/权限、文本转义和渲染网络访问限制必须同时设计。
- 真 PDF 是真实 `application/pdf` 可下载产物，不以 `.pdf` 改名 HTML，也不以浏览器“另存 PDF”代替服务端交付。预览与 PDF 使用同份快照和尺寸；页面零边距（实体打印是否能无边框取决于打印机能力，不承诺绕过硬件限制）。
- PDF 文件名为 `分类-证书名称-所有者名称-编号.pdf`，支持中文 UTF-8 `filename*` 和安全 ASCII fallback；清理路径/控制字符但保留合法中文。预览不计下载；成功返回附件计一次服务端交付，不声称能观测用户是否保存到硬盘。
- 撤销入口全部要求理由；状态转换、审计和通知语义一致。已签发记录及历史审计不物理删除；模板/分类依赖保护，不能通过修改模板破坏历史产物。
- 无支持的触发器不能显示 Active 示例规则；已有 ACTIVITY_CHECKIN 能力先形成真实可管理规则。课程、LE、积分/成就规则只在来源契约、幂等键和测试通过后逐类开放。
- 批量签发必须有预检、逐行错误、幂等键、持久批次状态、失败重试及结果记录；已有邮箱列表接口只是基础。先完成站内通知，外部邮件供应商未验收前不标记已送达。
- 管理操作和可信写回审计必须可靠持久化或具备明确可恢复的 outbox；访问统计可异步，但丢失策略与监控要可观测，不能默默吞掉关键审计错误。

### 2.3 档案、学习与集成（CP-FR-003/011/012/042）

- 档案默认私有，公开入口只能通过用户同意生成的令牌，支持期限、撤销、访问上限和字段范围；旧 `/profile/[userId]/credentials` 不恢复为可枚举公开页。
- Learning Experience 完成采用明确状态转换与业务唯一键；事务外存储失败具备补偿/可重试路径，重复或并发完成不多发证书/积分/里程碑。cohort/reviewer 只作用于新 LE 域。
- SHCW SDK/契约现有代码继续复用；真实渠道旅程必须通过 Core，不复制登录、报名、证书或积分状态。生产域名、来源、回调、cookie、CORS、targetPath 配置表先确认再启用。
- 外部学习分收件、规范化/对账、人工审核应用三个门槛。签名 webhook 收件成功不是学习完成；无批准 parser/provider 不自动写回 Passport。
- 社区、兑换、AI 保持各自专题的边界和默认开关。本轮不增加支付/履约供应商、公共人名目录、招聘匹配或自动决策。

### 2.4 UI、导航与测试（CP-FR-040/041）

- 证书后台八模块内容区严格参照 `ui-prototypes/certificates-admin.html`，不照搬 hero/footer、假数据或与隐私冲突字段。先提取字体族、字号、字重、行高、颜色、间距、边框和表格基准，再逐页复核 computed style 与截图；不以“相似”代替验收。
- 全局导航只列一级模块；证书功能在模块内部二级导航；所有后台只用同一 admin shell。现有菜单顺序不在本次文档编辑中改动；历史顺序冲突在视觉批次前确认。
- 320/390/768/1440px 必测；窄屏菜单折叠为三线按钮，展开/关闭/选中跳转、Escape、键盘焦点和滚动锁正确。长中文、编号、错误文本不越界；大表格在自身容器内横向滚动，不撑宽页面。
- 全页链接/按钮清单逐项对应真实路由或动作。无数据是真实空状态，失败可重试；不存在的功能应明确不可用，不用 `href="#"`、无处理器按钮或样例成功数据冒充。
- 前端成功提示必须来自真实 API 结果；刷新和重新登录后状态一致。用户、管理员、受限经理、核验员、匿名访问均有正反向测试。

## 3. 工作包与执行顺序

技术执行由全栈开发负责，测试由开发自动化 + 验收复核负责；产品负责人仅处理明确标注的业务决策，运维负责真实部署配置。下表“通过标准”必须有测试记录，不能仅以代码完成关闭。

### Phase 0：可信边界与可复现测试基线

| 工作项 | 需求/依赖 | 范围与通过标准 |
| --- | --- | --- |
| CP-TODO-218 | 全部 FR；最先 | 核准当前未提交基线、独立测试 DB/邮件桩/应用 origin；测试不得静默回退开发 .env，不复用未知服务器。允许清理的记录只属于测试命名空间；记录命令、版本与环境标识，不保存密钥。 |
| CP-TODO-219 | 004/010/041；218 | Activity 全入口资源授权及字段白名单；两名互不关联经理、分配/未分配核验员、普通用户、ADMIN 的读写/批量/同步拒绝矩阵通过。 |
| CP-TODO-220 | 010/012/020~023；219 | 统一 direct/checkin 与 scanner 权威规则；操作者取 session；错活动、无资格、过期、重放和并发双扫不产生有效签到/重复奖励。真实 DB 断言状态及审计数量。 |
| CP-TODO-221 | 005；218 | 稳定限流主体、生产配置检查与后端故障策略；UA 轮换仍命中账号/来源主桶，受信/伪造代理头、共享多进程、超时/失效场景通过。 |
| CP-TODO-222 | 003/010/041；219 | 导出授权与 PROJECT 同意最小披露；跨活动403、撤回后排除敏感字段、CSV注入与下载审计回归。 |
| CP-TODO-223 | 001~005/040/041；218~222 | 可重建真实登录 fixtures；zh/en 注册、登录、退出、重置/验证邮件桩、非 ACTIVE 会话、角色后台导航/直连 API、ID 冲突重试。关键流程不得因无 session 而 skip。 |

出口：P0 漏洞真实数据库回归通过；基础 lint/unit/build/schema 通过；测试不会修改共享开发/生产数据。这里通过不代表全部后续页面验收完成。

执行结果（2026-09-18）：CP-TODO-218~223 已在本地完成。测试环境强制独立数据库、3100 origin 和受控 mail outbox；Activity 全入口资源授权、统一扫码兼容入口、直接签到、稳定限流键和同意最小化导出已修复。真实验收覆盖两个互不关联经理、session actor、重复签到、服务器资产字段注入、PROJECT 导出/审计，以及 zh/en 与四角色认证、恢复和停用会话。积分/兑换占位 API 的 404/skip 不计入 P0 通过，也不构成功能完成声明。

### Phase 1：证书运营与真实产物闭环

| 工作项 | 需求/依赖 | 范围与通过标准 |
| --- | --- | --- |
| CP-TODO-224 | 031/033；Phase 0 | 修复产物异步更新、中文文件名、授权/计数；inline不增、成功附件增1、拒绝/缺失产物不增；真实 DB 校验计数，所有者/ADMIN/陌生人矩阵通过。 |
| CP-TODO-225 | 030~033；224 | 快照与公开核验一致、所有撤销入口理由、恢复/再生成状态、分类模板依赖。签发后更改姓名/模板再验证产物，私密字段不出现在匿名响应/HTML/日志；双并发状态转换一致。含 CP-AUD-001/002 显式条目：验证端点扩展字段改为资源级授权（持有者 + 来源活动受管的 EVENT_MANAGER；ADMIN/VERIFIER/STAFF 等角色名一律不构成授权），验证审计不存原始 verification code（有效证书只存 issue id，无效/预览只存截断哈希），历史日志脱敏迁移。 |
| CP-TODO-226 | 012/030/033/041；220、225 | 删除规则页虚假 Active，持久化管理已支持触发器；创建/编辑/停用/预检真实生效；不支持类型不可启用。先接现有 Activity，其他触发按后续依赖开放。 |
| CP-TODO-227 | 031/032；225 | 完成背景/变量/字体/印章/QR配置与真实PDF渲染，私有存储、失败可重试；A4横/竖与数字卡片样例，中文/长姓名、图像、二维码扫码、页数/边距、预览PDF一致验证。存储与字体许可先核准，禁止任意远程抓取。 |
| CP-TODO-228 | 030/031/033；225、227 | CSV和授权名单预检、批次/逐项状态、幂等重试及站内通知；重复/无效用户、部分失败、进程中断恢复不重复签发。首批接活动合格名单，LE来源依赖231，课程依赖236。 |
| CP-TODO-229 | 030/033/041；225 | 完善申请详情/历史/审核上下文、补充材料与重提、分页和错误恢复；owner与admin各闭环、并发审批只签发一次。附件在类型/大小/私有存储/授权/保留策略审查后单独开启。含 CP-AUD-006 显式条目：REQUEST_INFORMATION 与 REJECT 改用事务内 compare-and-set（`updateMany` 条件 `status = SUBMITTED`），竞争失败返回 409 且只产生一条最终状态事件、一组通知和一条关键审计。 |
| CP-TODO-230 | 032/033/041；224~229 | 关键审计持久化/可恢复策略、关联批次、真实总览指标及日志过滤；注入审计/存储失败验证可追踪恢复，不能显示假成功或伪造趋势。含 CP-AUD-005 显式条目：签发（单个/批次）、撤销、恢复、再生成、申请审核裁决的关键审计与业务写入同事务提交，审计持久化失败时整笔回滚并明确返回 500，不允许 best-effort `void writeCoreAuditLog` 假成功。 |
| CP-TODO-237 | 040/041；对应功能包及223 | 八模块 + 模板详情逐页原型对照，字体实测和四尺寸截图；所有导航/按钮行为、手机折叠菜单、单一后台壳验证。共用样式须回归夏校但不改其业务。 |

出口：后台配置模板/分类 -> 单个与批次签发/申请审核 -> 用户详情/PDF -> 扫码匿名最小核验 -> 撤销/恢复/再生成 -> 日志计数全链通过。公共验证不能下载私有产物；不支持的自动规则明确受限而非伪装已完成。

执行进度（2026-09-18）：CP-TODO-224~227 已完成本地代码与验收。产物下载计数、UTF-8 文件名、私有授权和缺失产物处理已通过真实数据库测试；公开验证改为签发快照身份，证书申请快照已补齐，撤销原因/操作者/时间持久化，并发撤销/恢复使用条件更新；已签发记录及被引用分类/模板拒绝物理删除。静态自动规则已替换为持久化 Activity 签到规则，旧入口收敛到统一 API，未支持触发器明确不可用。核心签发、再生成、申请批准及 Activity 签到签发现在生成真实 PDF；A4 横/竖、数字卡片、自定义尺寸、中文/长姓名、背景/印章、零页边距、实际像素及产物二维码解码通过。字体采用 `@fontsource-variable/noto-sans-sc` OFL-1.1 子集内嵌，生产构建追踪签发 API 所需字体文件。新增迁移 `20260918010000_certificate_lifecycle_snapshot`、`20260918020000_certificate_issuing_rules` 已应用于本地开发及隔离测试库，未部署生产；生产私有存储、外部渲染服务和保留策略仍属于发布门。

交接状态（2026-09-18）：开发在 CP-TODO-227 后停止。CP-TODO-228 仅完成现状勘察，尚未新增批次数据模型、迁移、服务、API、UI或测试；当前邮箱列表在单一请求中 `Promise.all` 并发签发，不构成持久化批次能力。下一位 agent 必须按 [Certificate Phase 1 交接说明](AGENT_HANDOFF_20260918_CERTIFICATE_PHASE1.md) 从可恢复、幂等的批次/逐项状态开始，首批只接 Activity 合格名单，不接夏校、课程或其他 Programme 业务流程。

执行进度更新（2026-09-18 续）：CP-TODO-228 已按上述边界完成本地代码与验收。新增迁移 `20260918030000_certificate_batch_issuance`（`CertificateBatch`/`CertificateBatchItem`、幂等键、逐项状态/尝试/租约/错误/关联证书、批次部分唯一 sourceId 索引）并已应用于本地开发与隔离测试库；单个收件人签发逻辑抽取至 `lib/server/certificate-issuance.ts` 供单发路由与批次服务共用；批次服务提供服务端预检（格式错误/列表重复/已签发报告，Activity 合格名单仅服务端推导 COMPLETED/CERTIFIED 参与）、事务化批次/逐项创建、小批量（默认 5、上限 10）分块处理、逐项 compare-and-set 认领与 5 分钟租约、证书已建但项未更新的对账（重试关联既有证书而非重复签发）、恰好一次站内通知（关闭时为 0）以及批次创建/处理/重试/完成审计关联。管理端 API 位于 `/api/admin/certificates/batches`（预检/列表/创建/详情/处理/重试失败），签发页批量页签改为 预检 → 创建批次 → 轮询分块处理 → 逐项结果/重试，并列出最近批次可恢复查看。验收证据：`tests/certificate-batch-issuance.test.mjs` 12 项、`tests/certificate-issuance-service.test.mjs` 4 项、签发路由刷新测试、`tests/api/certificate-batches-api.test.ts` 8 项真实数据库测试（幂等重放、并发不重复签发由 CAS 单测覆盖、部分失败真实状态与重试、Activity 名单服务端推导忽略伪造名单、通知恰好一次/零、真实 PDF 与审计）；同日全量门禁 366/366 node、API 16 通过+7 占位 skip、浏览器 27 通过（41 项）+14 显式 skip、lint/tsc/build/db:validate/31 项迁移通过。外部邮件、后台 worker 与非 Activity 来源不在本包范围。

执行进度（2026-09-19）：审计报告 P0 项 CP-AUD-001/002 已按 225 范围关闭。`certificate-verification.ts` 的扩展字段授权从角色名改为资源级：仅持有者与来源活动受管的 EVENT_MANAGER（经 `canManageActivity` 核对 `organizerUserId`）获得 STAFF 扩展字段；ADMIN（依 CP-FR-051 无常态正文浏览）、VERIFIER（含已分配）、STAFF、SPECIAL_PASS_MANAGER 在该端点一律仅获公开白名单字段。来源活动解析支持 `ACTIVITY_CHECKIN`（activity-checkin-issuance 前缀）与 `CERTIFICATE_BATCH`（certificate-batch-item 前缀 → 批次 activityId）；`CERTIFICATE_APPLICATION` 等客户端可伪造来源不参与授权。验证审计脱敏：有效证书日志只存 `CertificateIssue.id` 且 metadata 不含原始 code；preview/not-found 日志 subjectId 只存 `fp:<sha256-16>` 截断指纹；新增迁移 `20260919010000_scrub_certificate_verification_audit_codes` 清除历史 metadata 原始 code 并将历史 subjectId 置换为不可逆指纹（md5，SQL 内置）。验收证据：`tests/certificate-verification-service.test.mjs` 角色矩阵与审计断言、`tests/api/certificate-verification-authorization.test.ts` 真实数据库六角色负向矩阵（匿名/持有者/相关 EM/无关 EM/已分配与未分配 VERIFIER/ADMIN）+ 审计 payload 断言、`tests/phase0-core-api-runtime-regression.test.mjs` 原 "staff sees extended fields" 场景改为资源授权语义。未部署生产；生产日志清理以迁移部署为准。

执行进度更新（2026-09-19 续）：审计报告 P1 项 CP-AUD-005/006 已按 229/230 范围关闭。申请审核 `REQUEST_INFORMATION`/`REJECT` 从事务外读状态+普通更新改为事务内 compare-and-set（`updateMany` 条件 `status = SUBMITTED`，`count = 0` 即竞争失败返回 409），事件、通知与审计同事务且恰好一条；`APPROVE_AND_ISSUE` 原有 Serializable 事务与 P2002/P2034 重试保持不动。关键状态转换的审计从 best-effort `void writeCoreAuditLog(...).catch(...)` 改为与业务写入同一事务：单个/批次签发（`certificate-issuance.ts` 第三阶段）、撤销、恢复、再生成均在事务内写 `core_audit_logs`，审计持久化失败整笔回滚并返回明确 500（"No state was changed."），不再出现"状态已改但审计缺失"的假成功；再生成顺带从普通 update 改为条件更新，消除覆盖并发撤销/恢复的状态竞争。证书可见性切换与模板复制审计属非关键路径，保留 best-effort 并已在审计文档标注。验收证据：`tests/api/certificate-application-review-api.test.ts` 真实数据库并发审核（一胜一负 200/409，事件/通知/审计各恰好一条，重复审核 409）、`tests/phase0-core-api-runtime-regression.test.mjs` 新增审核 CAS/审计失败 500/生命周期审计失败 500 场景（共 13 项）、`tests/certificate-records.test.mjs` 生命周期路由事务审计断言。未部署生产。

执行进度更新（2026-09-19 再续）：CP-TODO-242 已关闭。新增迁移 `20260919070000_person_institution_governance`（Person/Institution `mergedIntoId` 合并链 + 索引/外键，纯 additive），开发库与隔离测试库已应用（34 项迁移同步）。治理服务 `lib/server/person-institution-governance.ts`：认领仅允许 VERIFIED 且未关联账号的 Person 绑定既有账号（不开户、不发邀请、审计同事务）；机构代表权授予/撤销（撤销 CAS 一次性、有效期窗口、撤权即时生效、MANAGE 可再委托），判定只读 `InstitutionRepresentation`，**不读取任何任职关系**；Person/Institution 合并在同事务迁移 speakers/affiliations/roleProfiles/活动与事件关联/代表权/子机构，别名并入目标，源记录保留且旧 id 经解析链可读；用途受限投影 `institution_context`/`person_identity` 白名单（内部字段如 publicContactEmail/legalName/orcid/bio 不泄漏，未知 purpose 默认拒绝）。消费端路由 `GET /api/institutions/[id]`（匿名 401、任职-only 403、有效代表权 200 投影）；治理端路由：代表权授予/撤销、Person/机构合并（均 ADMIN 或 MANAGE 委托，关键审计同事务）；管理端 `GET /api/admin/{people,institutions}/[id]` 接入合并链解析。验收证据：`tests/person-institution-governance.test.mjs` 9 项源码级断言（窗口/委托/CAS/合并/投影/审计），`tests/api/person-institution-governance-api.test.ts` 真实数据库矩阵（任职≠授权 403、READ 不能授权而 MANAGE 可委托、撤权即时 403、过期窗口 403、认领投影无内部字段、合并旧 id 在消费端与管理端均可解析、五类治理审计落库）。未部署生产；代表权全面接入各业务面随 246~253 逐面落地。

执行进度更新（2026-09-19 第三批）：CP-TODO-243 已关闭（真实渠道环境验收除外，随 235 另行验收）。scope 契约目录落入 contracts（`CHANNEL_SCOPE_VALUES`：channel:session:bridge / channel:session:exchange / channel:certificates:verify；新增 CHANNEL_MACHINE_AUTH_FAILED / CHANNEL_SCOPE_DENIED / CHANNEL_ORIGIN_DENIED 错误码）。迁移 `20260919080000_channel_client_machine_auth` 为 `channel_clients` 增加 `machineKeyHash`（仅存 sha256 摘要，明文绝不入库，明文仅创建响应出现一次）。`lib/server/channel-client-auth.ts`：`authenticateChannelMachine` 默认拒绝——未知/已撤销/USER_FACING 客户端 401 UNKNOWN_CLIENT、机器密钥不匹配或未配置 401、scope 不在 allowedScopes 403、Origin 缺失或不在 allowlist 403（allowlist 为空仅限私网服务端场景）；登记/更新/撤销生命周期全部审计同事务，key 冲突 409。v1 证书验证路由新增向后兼容机器认证分支：携带 `X-Channel-Client-Key`/`X-Channel-Machine-Key` 头时按登记客户端认证并跳过 SHCW 环境门（客户端获得公开白名单结果）；无头请求保持旧有 SHCW 行为完全不变；携带但认证失败一律 fail-closed。管理端登记路由 `POST/GET /api/admin/channel-clients`、`PATCH /[id]`、`POST /[id]/revoke`（列表只暴露 machineKeyConfigured 布尔，不泄漏摘要字段）。SDK 增加 `channelMachineAuthHeaders` 与 `verifyV1ChannelCertificate(code, { machine })`（仅供服务端代码使用）。验收证据：`tests/channel-client-auth.test.mjs` 4 项源码级（负向矩阵/凭据头解析/登记校验/一次性明文/更新撤销 CAS），`tests/api/channel-client-auth-api.test.ts` 真实数据库矩阵（未知密钥 401、错误密钥 401、origin 缺失/错误 403、scope 移除 403、正确凭据进入业务层、撤销后立即 401、二次撤销 409、无头 legacy 路径 CHANNEL_DISABLED 不变、列表无 secret 泄漏、登记/更新/撤销审计落库）。未部署生产。

执行进度更新（2026-09-19 第四批）：CP-TODO-244 已关闭（本地）。可靠 outbox 落地：迁移 `20260919090000_reliable_outbox_dispatch` 新增 `OutboundDispatch`（idempotencyKey 唯一 + payloadHash 内容寻址；状态 PENDING/PROCESSING/SUCCEEDED/DEAD；attempts/maxAttempts/nextRetryAt/租约；receiptJson）与 `channel_clients.callbackUrl`（离 localhost 强制 https）。服务 `lib/server/reliable-dispatch.ts`：payload 规范化哈希（键序无关）；同 key 同内容幂等去重、同 key 异内容 409；处理侧 compare-and-set 租约认领 + 指数退避（429/5xx/网络错误重试，其余 4xx 立即死信，attempts 耗尽死信）；回执对账幂等且**旧 revision 一律拒绝**（旧事件不能覆盖新状态）；死信管理端重投（仅 DEAD 可重投）。默认传输为 HTTP POST 到登记 callbackUrl，携带 `X-Dispatch-Id` / `X-Dispatch-Idempotency-Key` / `X-Dispatch-Revision` 头，10 秒超时。生产者接入证书撤销/恢复：目标选择（持有 callbackUrl 且 scope 匹配的启用 MACHINE 客户端）在事务外预取，事件在**状态变更同一事务**入队——撤销 200 即保证出站事件已落库（取消/撤权优先，无假成功）；payload 只含 issue id、状态、时间与理由，不含 verification code 或持有者账号。管理端路由：列表、`POST /process`（租约批处理）、`[id]/retry`、`[id]/reconcile`（对账审计）。验收证据：`tests/reliable-dispatch.test.mjs` 7 项源码级（去重/租约/退避/死信/对账/重投/目标过滤），`tests/api/reliable-dispatch-api.test.ts` 真实数据库端到端（进程内 HTTP 接收器：同事务入队断言、真实回调投递与头断言、回执幂等与旧 revision 409、连接拒绝退避至死信、管理端重投、治理审计）。接收侧（inbox）的签名/时间窗/去重为接收 Programme 的契约责任（见 FIELD_OWNERSHIP ADR），CP 侧回执与 revision 护栏已就位。未部署生产。

执行进度更新（2026-09-19 第五批/Wave 1）：CP-TODO-247/248/249/250/251 已关闭（本地）。基础设施：Wave 1 迁移 `20260919100000_private_records_consents_publications`（scoped_records/record_revisions/controlled_assets/evidence_versions/consent_records/external_decision_receipts/publication_projections）当日上午预建并应用；本批补 `20260919120000_object_authorization_personal_scope`（ObjectAuthorization.programmeId 可空——个人记录的对象级授权，scope 对象语义不变）与 `20260919130000_external_receipt_content_hash`（回执 contentHash + validUntil + issuer 索引）；均已应用于本地开发与隔离测试库，未部署生产。contracts 新增 24 个错误码、CONSENT_PURPOSE_VALUES（六目的）、CHANNEL_SCOPE_VALUES += channel:decisions:submit / dispatch:publications、六组载荷 zod schema（strict）。五个服务与十八个路由薄层（会话/管理端/机器认证三种门面）：

- `private-records.ts`（247）：默认 Private；所有者 > ObjectAuthorization（用途+窗口，多条取最高）> Programme 成员；CAS 更新（409 不覆盖）+ 不可变修订；撤回后非所有者 404。
- `controlled-asset-storage.ts` + `controlled-assets.ts`（248）：magic-bytes 嗅探拒恶意/错误 MIME、大小+sha256 完整性、JPEG EXIF/PNG eXIf 定位元数据剥离后重算存储摘要、finalize 扫描门禁（PENDING 不可用/INFECTED 隔离/管理端检疫路由）、不可变证据版本、衍生权限仅"原始→衍生"单向继承；访问判定与可用性分离（授权读者遇隔离统一 409，未授权一律 403，不泄漏扫描状态）。
- `consents.ts`（249）：六目的互不复用；监护代授须 guardian==grantor + evidenceJson 验证依据；同范围再授版本化取代；撤回即时；频道/对象匹配（null=通用）。
- `external-decision-receipts.ts`（250）：机器认证（issuer=登记客户端 key）；**内容哈希只覆盖 7 个内容字段**（修复同键重放永 409 的缺陷）；同键同内容去重/同键异内容 409/旧 revision 409 RECEIPT_STALE；最新决定须 APPROVED 未过期（反馈/撤销≠批准）。
- `publication-gateway.ts`（251）：不可变版本投影（同版同内容幂等/异内容 409）；撤回版本禁止复活（409 须发新版）；发新版不下架有效旧版；fail-closed 公开读门 no-store；同意门（CONSENT_REQUIRED/CONSENT_WITHDRAWN 分码）+ 可选 approvalReceipt 批准回执门（schema 与路由已透传）；发布/撤回同事务向 dispatch:publications 订阅者扇出定位级 payload（无正文）。

测试环境配套：`.env(.test/.example)` 增 `CONTROLLED_ASSET_STORAGE/CONTROLLED_ASSET_LOCAL_ROOT`；登录限流改环境可调（`RATE_LIMIT_AUTH_LOGIN_LIMIT/WINDOW_MS`，默认 8/5min 不变，测试库调 200——修复并行 API 文件共享同一管理员账号登录互相挤爆 429 的测试基建问题，非产品行为变更）。验收证据：源码级 64 项（`private-records` 8 / `controlled-assets` 19 / `consents` 12 / `external-decision-receipts` 11 / `publication-gateway` 14）；真实数据库 API 矩阵 5 文件（records/assets/consents/receipts/publications，含越权矩阵、并发 CAS、错误 MIME/完整性失败、扫描门、衍生继承、撤权即时、幂等/冲突/陈旧、同意门与批准回执门、dispatch 行无正文、审计落库）。范围保护保持：不含 Inquiry/ActionPlan/导师等业务模型与页面。未部署生产。

剩余 V2.1：245（来源映射执行层，下批）、246/253/257（Wave 2 迁移已预建，服务未开始）、252、258、259。

当日全量门禁（Wave 1 完成后）：`npm test` 482/482 通过 0 skip；`npm run test:api` 115 项（109 通过 + 6 项既有显式 skip 占位，0 fail；`CP_API_TEST_CONCURRENCY` 默认 4 控制文件级并行）；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。所有迁移已应用于本地开发与隔离测试库，未部署生产。

执行进度更新（2026-09-19 第六批）：CP-TODO-245 已关闭（本地）。迁移 `20260919140000_source_activity_execution`（`source_object_mappings.contentHash` + 每活动一条 ACTIVE 映射的部分唯一索引）已应用于本地开发与隔离测试库。服务 `lib/server/source-activity-mapping.ts`：bind（来源三元组唯一 + 幂等键内容哈希同内容去重/异内容 409 + 并发首接入 P2002 winner 重读；authoritativeFields 拒绝 CP 受控字段 status/slug/organizer/报名窗口等与未知列；edition 必须属于 programme）；applySourceRevision（数字段感知版本序——"2.10">"2.9"，v3 后 v2 一律 409 SOURCE_MAPPING_STALE 不覆盖，同版本同内容幂等、同版本异内容 409，事务内 CAS 竞争 409，白名单外与 CP 受控字段 400，startTime/endTime 转 Date）；publishSourceActivity（sourceVersion 必须正整数；不可变版本投影同版同内容幂等/异内容 409/撤回版本禁止复活 409 PUBLICATION_RESTORE_FORBIDDEN/旧来源版本 409；dispatch:publications 扇出定位级 payload 无正文）；cancelSourceActivity（取消优先：活动 status CAS 置 CANCELLED + 撤回全部已发布版本 + publication.withdrawn/activity.cancelled 扇出；幂等——再取消 cancelled:false、withdrawnVersions:[]）；关键写入（bind/apply/publish/cancel）与 core_audit_logs 同一事务。CP 侧守卫（未映射活动行为完全不变）：PATCH `/api/activities/[id]` 触及来源权威字段 → 409 ACTIVITY_SOURCE_FIELD_CONFLICT；POST `/api/activity-applications` 已映射活动须来源已发布且未取消（ACTIVITY_SOURCE_NOT_PUBLISHED / ACTIVITY_SOURCE_CANCELLED，取消优先于未发布判断）。机器门面 `/api/external/activity-mappings`（bind/revisions/publish/cancel，scope `channel:activities:source`，默认拒绝）+ 管理端 `GET /api/admin/activity-mappings`（ADMIN）；contracts 四组 zod schema + `ACTIVITY_SOURCE_OWNED_FIELD_PATTERN` + 六个错误码（SOURCE_MAPPING_NOT_FOUND/CONFLICT/STALE、ACTIVITY_SOURCE_NOT_PUBLISHED/CANCELLED/FIELD_CONFLICT）；跨 Programme 寻址隔离以 clientKey 为 sourceSystem（B 客户端对 A 的三元组一律 404）。验收证据：`tests/source-activity-mapping.test.mjs` 25 项源码级断言（版本序/哈希/绑定幂等与并发/应用 CAS/发布与取消扇出无正文/五态公开门）；`tests/api/source-activity-mapping-api.test.ts` 13 项真实数据库矩阵（机器认证 401/403、绑定去重与冲突、跨 Programme 404、应用版本序与字段断言、CP 编辑守卫与未映射回归、发布幂等/恢复保护、报名门、取消幂等与撤回、dispatch 行无正文、审计落库）。当日全量门禁（第六批完成后）：`npm test` 507/507 通过 0 skip；`npm run test:api` 128 项（121 通过 + 7 项既有显式 skip 占位，0 fail）；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。已知测试基建事项：隔离测试库 outbound_dispatch 行历次运行只增不减，本次全量前已清理一次，建议后续在 `run-api-tests.mjs` 加前置清理；`tests/api/reliable-dispatch-api.test.ts` 与 dev server 存在既有并发脆弱性（分发池超批次时 forceDue 行可被淹没，与本次无关，未触发）。未部署生产。

剩余 V2.1（第六批完成后）：246/253/257（Wave 2 迁移已预建，服务未开始）、252、258、259。CP-AUD-003（P0 基座）随本批在本地关闭。

执行进度更新（2026-09-19 第七批）：CP-TODO-246 已关闭（本地）。迁移 `20260919150000_activity_occurrence_execution`（`activity_applications.occurrenceId` 可空 + 索引/外键；`activity_person_roles` 唯一(activityId,personId,roleType)；`activity_external_classifications` 唯一(activityId,taxonomySystem,taxonomyRef) + idempotencyKey 唯一 + sourceVersion/status；`activity_checkin_records.isCorrection/noteJson`；均已应用于本地开发与隔离测试库，未部署生产）——Wave 2 预建迁移（20260919110000）的 occurrences 表与本批表结构一并就位。四个服务/执行层：

- `activity-occurrences.ts`：期次 create/update/cancel（窗口校验、capacity 正整数、取消仅允许无占用的 SCHEDULED 且一次性 CAS、容量收缩不得低于 admittedCount）；`claimOccurrenceSeat`/`releaseOccurrenceSeat` 读值后 compare-and-set（容量 null=不限），并发确认永不超额；`admitApplicationToOccurrence` 同事务占位 + CAS 申请→APPROVED 写 occurrenceId（状态竞争失败归还名额）；`releaseSeatAndPromoteWaitlist` 释放后按申请时间提升最早候补（提升竞争不占名额、无候补名额留空）。
- review 路由 opt-in `occurrenceId` 路径：APPROVED 原子占位、离开 APPROVED 释放+转正（转正通知 + 与确认一致的奖励/参与语义）、PROJECT 申请拒绝期次、**未携带 occurrenceId 的路径行为逐字节不变**（夏校冻结兼容）；batch-review 按设计不接入期次。
- `activity-person-roles.ts`：指派幂等（唯一三元组 + P2002 竞争重读）、任职不自动产生角色；统计 `distinctPersonCount` 按人去重，一人多角色不双计。
- `activity-taxonomy.ts` + `recordAttendanceCorrection`：分类引用只存合法版本投影（幂等键+内容哈希去重/异内容 409 TAXONOMY_CONFLICT、版本单调 TAXONOMY_STALE、撤回幂等且更高版本可恢复、同事务审计），机器门面复用 scope `channel:activities:source`，公开读 `/api/activities/[id]/classifications`；出席更正理由必填 + 证据引用落 checkin 记录 noteJson、已出席 409 不重复记录、状态机约束、`rewardsTriggered=false`（更正绝不产生奖励），路由 `POST /api/activity-participations/[id]/attendance-correction`（管理者，同事务审计 ACTIVITY_ATTENDANCE_CORRECTED）。

期次路由 `/api/activities/[id]/occurrences(+[occurrenceId])`（管理者写、公开列表隐藏 CANCELLED）、人员路由 `/api/activities/[id]/people(+[assignmentId])`；contracts 新增 OCCURRENCE_NOT_FOUND/UNAVAILABLE/FULL、TAXONOMY_CONFLICT/STALE/NOT_FOUND、ATTENDANCE_CORRECTION_REASON_REQUIRED/ALREADY_RECORDED、PARTICIPATION_NOT_FOUND 错误码与期次/角色/分类/更正 zod schema。验收证据：`tests/activity-occurrences.test.mjs` 14 项源码级断言（占位并发/转正/取消/容量/去重/版本护栏/更正状态机）；`tests/api/activity-occurrences-api.test.ts` 真实数据库矩阵（匿名 307 登录语义、非组织者 403、满员 409→候补→释放转正全链 + 转正通知/审计、并发双确认恰好满额、角色统计不双计、机器认证 401/403 + 幂等/冲突/版本/撤回恢复、更正 400/403/409 + 证据与审计落库）。CP-FR-054/055/056；不含 programme 招募/分类业务规则。当日全量门禁（第七批完成后）：`npm test` 521/521 通过 0 skip；`npm run test:api` 128/128 通过 0 fail 0 skip（隔离库已应用全部 42 项迁移）；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。测试基建加固两件（计划文档既有建议的落地，非产品行为）：`scripts/run-api-tests.mjs` 启动前置清理 `outbound_dispatch`（历次运行只增不减导致分发池淹没）；`tests/api/reliable-dispatch-api.test.ts` 死信用例改为循环至本行 DEAD（原固定 5 轮在并发文件共享分发池时会被其它到期行挤占批次数，属既有脆弱性）。未部署生产。

执行进度更新（2026-09-19 第八批）：CP-TODO-253 已关闭（本地）。迁移 `20260919160000_contribution_fact_execution`（部分唯一索引：每 (personId, contributionType, sourceType, sourceId) 仅一条 ACTIVE 事实 + occurredAt 列 + programme/correction 索引；已应用于本地开发与隔离测试库，未部署生产）。服务 `lib/server/contribution-facts.ts`：

- 录入：自报起点恒为 SELF_REPORTED（录入人含 ADMIN 不自动升级第三方核验）；同自然键双 ACTIVE 一律 409 CONTRIBUTION_CONFLICT（唯一索引 + 空来源显式查重 + P2002 竞争映射）；programme 事实须 AccessMembership 成员；机构主体事实代录须 InstitutionRepresentation MANAGE；关键写入与审计同事务。
- 评估：等级单调仅升不降（同等级幂等、降级 409 CONTRIBUTION_VERIFICATION_INVALID）；被记录人本人即使持有代表权也不得评估自己（自报不升级第三方核验）；评估人限 ADMIN / MANAGE 代表 / programme admin-operator；CAS + 同事务审计。
- 更正：原行 CAS 转 CORRECTED，successor 接续同一自然键（correctionOfId 链，历史可溯）；本人更正回退 SELF_REPORTED、授权管理面更正保留等级；CORRECTED 行不可再更正/撤回。
- 撤回：幂等（再撤回 withdrawn:false）；撤回立即从派生统计消失（撤销可复算）。
- 派生统计 contributionStats：只聚合 ACTIVE——factCount、distinctPersons 按人去重、数值按人计量求和（绝不把活动总量复制给每人）、等级分布；只出聚合量不出个体行。列表为 record/portfolio 适配读取面（ACTIVE 默认，includeHistory 可选）。
- 路由 `/api/contributions`（POST 录入/GET 列表）、`/api/contributions/stats`、`/[id]/evaluate|correct|withdraw`；contracts 新增 CONTRIBUTION_NOT_FOUND/CONFLICT/VERIFICATION_INVALID/ACCESS_DENIED 与核验等级枚举、录入/评估/更正/撤回 zod schema。
- 不重复奖励：服务不触发任何奖励钩子，且每自然键仅一条 ACTIVE 事实，适配器聚合永不双计。

验收证据：`tests/contribution-facts.test.mjs` 8 项源码级断言（自报起点/代录 403/同键 409 含空来源/评估单调性与本人禁令/更正链与等级回退/撤回幂等/统计去重与按人求和/机构代表矩阵）；`tests/api/contribution-facts-api.test.ts` 真实数据库矩阵（匿名 401、自报 201 + 审计、代录 403、重复 409、多来源并列、本人/无关评估 403、ADMIN 升级 + 幂等 + 降级 409、更正链 + 统计即时复算、撤回幂等 + 统计消失、列表按人/机构授权矩阵、统计端点仅聚合无个体行、机构事实代表权矩阵）。CP-FR-062。当日全量门禁（第八批完成后）：`npm test` 529/529 通过 0 skip；`npm run test:api` 133/133 通过 0 fail 0 skip（隔离库 43 项迁移同步）；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。未部署生产。

执行进度更新（2026-09-20 第九批）：CP-TODO-257 已关闭（本地）。迁移 `20260919170000_notification_delivery_privacy_lifecycle`（`notifications.nextRetryAt/deadLetteredAt` + (status,nextRetryAt) 索引；append-only `privacy_markers` 表；`users.anonymizedAt/anonymizedReason`。通知偏好**复用既有** per-user `notification_preferences` 表——实施时发现该表已存在（email/inApp/sms/marketing 开关，注册与 dashboard 路由已在用），故未建新表；均已应用于本地开发与隔离测试库，未部署生产）。三个服务：

- `notification-delivery.ts`（CP-FR-066）：`deliverNotification` 每次投递落 `NotificationAttempt`（SUCCESS/FAILED/SKIPPED），EMAIL/SMS 只发标题+定位链接（私密正文绝不外发，源码级断言），失败指数退避（nextRetryAt）超限死信（deadLetteredAt），死信幂等；偏好关闭（含 marketing 门）→ SKIPPED + 死信不无限重试；`processDueNotifications` 只处理到期行；路由 `POST /api/admin/notifications/process`、`GET /api/admin/notifications/[id]/attempts`（ADMIN，审计）。
- `privacy-reports.ts`（CP-FR-067）：`activityPrivacyReport` 只出聚合量（申请/参与按状态、checkin 数、distinctPersons=申请∪参与并集去重）；小样本抑制（0<n<阈值 → null + suppressedCells），阈值取 `CP_PRIVACY_REPORT_MIN_CELL`（默认 5，审批后配置）；路由 `GET /api/reports/activity-privacy`（组织者/ADMIN）。
- `privacy-lifecycle.ts`（CP-FR-068）：三动作分开——导出 `GET /api/account/export`（本人记录带正文、他人授予仅索引、资产元数据索引含 sha256、显式 otherAuthorsContentIncluded=false、no-store+attachment）；删除 `POST /api/account/delete`（须 `confirm:true` 否则 400 PRIVACY_DELETE_CONFIRMATION_REQUIRED；匿名化 User/Person、吊销会话、撤回本人 ACTIVE 记录、逐对象落 privacy 标记、同事务审计、返回受限保留说明——审计/凭证/活动事实/对账四类明示保留）；备份回放 `POST /api/admin/privacy/replay-markers`（ADMIN：DELETED 用户重匿名化+会话吊销、WITHDRAWN 记录重新撤回，幂等 skip，回放审计）——恢复先重放标记再开放读取。

contracts 新增 NOTIFICATION_NOT_FOUND / PRIVACY_DELETE_CONFIRMATION_REQUIRED / PRIVACY_MARKER_REPLAY_INCOMPLETE 与批处理/报告/删除 zod schema。验收证据：`tests/notification-privacy.test.mjs` 11 项源码级断言（退避序列/偏好门/抑制单元格/仅索引导出/删除+回放幂等）；`tests/api/notification-privacy-api.test.ts` 真实数据库矩阵（真实邮件 outbox 断言无私密正文、偏好关闭→SKIPPED 死信且不发送、报告 401/403+抑制、导出所有权矩阵、删除确认门+匿名化+会话吊销+撤回+标记+无法再登录、回放幂等+审计）。测试基建再加固（既有脆弱性的暴露与本批并发负载相关）：reliable-dispatch 死信/接收器两循环的 process 上限 10→50（文件作者注释已说明共享池需分批直至本行成功，上限 10 在 15 个文件并发下会被其它到期行占满）；经对照实验（隔离运行服务逻辑 5 轮必死信、配对运行 12/12）确认服务实现无误。当日全量门禁（第九批完成后）：`npm test` 540/540 通过 0 skip；`npm run test:api` 141/141 通过 0 fail 0 skip（默认并发 4；隔离库 44 项迁移同步）；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。未部署生产。

执行进度更新（2026-09-20 第十批）：CP-TODO-252 已关闭（本地）。通用 sourceRef/schema 契约与 CP 侧 FS 接入示例。contracts 新增 `SourceRefSchema`（system=登记 ChannelClient key、objectType∈person/institution/activity/record、objectId）与 `SourceRefResolveResponseSchema`（schemaRef/locator/contentHash/projection），scope 目录新增 `channel:source:resolve`，错误码 SOURCE_REF_NOT_FOUND / SOURCE_SCHEMA_UNKNOWN。服务 `lib/server/source-ref-contracts.ts`：`resolveSourceRef`——system 必须是已登记且启用的 MACHINE ChannelClient，否则 404 失败关闭（不泄漏目录）；person/institution 走 mergedIntoId 合并链解析到最终目标；四类对象只暴露版本化白名单投影（cp.person_identity/v1、cp.institution_context/v1、cp.activity_brief/v1、cp.record_summary/v1）——bio/orcid/法名/联系邮箱/组织者账号/记录正文等内部字段绝不进入投影；返回 locator + 投影 sha256（来源方做版本快照与对账）；同事务 source_ref.resolve 审计。`validateAgainstSourceSchema` 只认 CP 白名单 schema，不理解 programme 专有 schema。机器门面 `POST /api/external/source-refs`（机器认证 + scope 门）；SDK 新增 `ClimatePassportClient.resolveSourceRef`（服务端，contracts 响应 schema 校验）。FS 接入以示例流程落地（本批测试即示例）：FS 登记自己的系统（client key 即 sourceRef.system），在自己侧只存 sourceRef 三元组，经门面解析并按 schemaRef 校验投影——不需要理解 CP 内部模型，CP 不执行专有规则、不建业务关系图。验收证据：`tests/source-ref-contracts.test.mjs` 5 项源码级断言（白名单/合并链/失败关闭/哈希稳定性/schema 校验）；`tests/api/source-ref-contracts-api.test.ts` 真实数据库 FS 模拟矩阵（机器认证 401/403、四类对象 contracts 响应 schema 全通过、白名单负断言、未知系统 404、停用系统 401 认证层失效、哈希对账、审计落库）。CP-FR-071/072。当日全量门禁（第十批完成后）：`npm test` 545/545 通过 0 skip；`npm run test:api` 144/144 通过 0 fail 0 skip（默认并发 4）；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。未部署生产。

执行进度更新（2026-09-20 第十一批）：CP-TODO-258 已关闭（本地）。CP 自有通用页面 + 可复用 UI 组件 + CP 侧端到端测试。新工作区包 `@climate-passport/passport-ui-flows`（与 contracts/sdk 同构——TS 源直接导出，无构建步骤；纯展示组件 `DataActionCard`/`ConfirmDangerAction`（键入确认危险操作，aria-disabled，受限保留说明面）/`StatusPill`，无数据获取、无项目专属流程、className+data-tone 主题化；storybook stories）。三个 CP 自有页（薄 server 页 + `requireAuthenticatedUser` 回跳 + 双语 Screen + 手写 CSS --cp-* 令牌与 480/760/1024 断点 + 桌面默认共四档）：`dashboard/account-data`（导出下载/删除键入 DELETE 确认/保留说明——FR-068 三动作分开的前端面）、`dashboard/consents`（FR-060 前端面）、`dashboard/records`（FR-057 前端面）；账户菜单加三页双语链接。e2e `tests/e2e/cp-data-governance.spec.ts` 10 项真实浏览器验收：回跳（未登录→登录→返回原页）、zh/en 文案、360/768/1024/1440 四视口无横向溢出、键盘 Tab+Enter 展开移动菜单、导出 download 事件与文件名、删除确认门（DISABLED→DELETE→成功+保留说明→会话失效）、授权与记录的创建/列表/撤回。源码级 `tests/cp-ui-flows.test.mjs` 6 项文件级断言。CP-FR-072/073：programme 业务工作台（课题/导师/编辑/席位/工单）仍由各 programme 自研，SDK 不内嵌项目专属流程；e2e 现有 14 项显式 skip 占位保持不变（未实现功能保持关闭）。当日全量门禁（第十一批完成后）：`npm test` 551/551 通过 0 skip；`npm run test:api` 143/143 通过 0 fail 0 skip（默认并发 4；重跑一次——publication-gateway 扇出断言为既有并发敏感项，本批前端改动无关）；`npm run test:e2e` 37 通过 + 14 既有显式 skip 占位，0 fail；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。未部署生产。

执行进度更新（2026-09-20 第十二批）：CP-TODO-259 已关闭（本地），V2.1 共享层全部交付完毕。四件交付物：

- `docs/V21_CAPABILITY_TEST_TRACEABILITY.md`：全部已交付 CP-TODO（240~258）→ 源码级断言/真实数据库 API/浏览器 e2e 三层证据矩阵 + 各批门禁计数；scope 反例、撤回并发、故障恢复三节对照 FR-073；235 真实环境验收边界声明。
- `docs/OPERATIONS_RECOVERY_HANDOVER.md`：环境分层（开发/隔离测试/生产未部署）、六事项责任矩阵（CP 平台运维/CP 安全/Programme 运营/Programme 技术）、备份恢复 runbook（**恢复先重放撤回/删除标记再开放读取**，含验证与留档要求）、出站/通知死信运行手册、监控点（审计动作清单、DEAD 告警建议、小样本阈值审批门）、支持升级边界、密钥管理（machine key 仅 sha256）、迁移管理。
- `docs/PER_PROGRAMME_RELEASE_RECOMMENDATION.md`：七项发布门禁清单（零 skip 范围、迁移 dry-run 证据、回放演练、凭据轮换、阈值审批、回滚演练、未验收关闭）；分 programme 建议——SHCW 冻结仅兼容回归（v1 字节级不变）、FS 契约就绪（青年政策门未批前不开放真实未成年人）、Convener 外部自研；发布顺序建议；明确不触发部署。
- `scripts/migration-dry-run.mjs` + `tests/v21-acceptance-handover.test.mjs`：隔离环境强制的 scratch 库空库全量迁移演练（44 迁移/118 表/validate 通过/强制清理，2026-09-20 实跑）与 4 项文档级断言。

当日全量门禁（第十二批完成后）：`npm test` 555/555 通过 0 skip；`npm run lint` 0 warning/error；`npm run db:validate` 通过；`next build` 成功。未部署生产。剩余外部事项：CP-TODO-235 真实渠道环境验收（另行授权）、CP-AUD-008 工作树分阶段提交。

### Phase 2：学习写回和渠道接入

| 工作项 | 需求/依赖 | 范围与通过标准 |
| --- | --- | --- |
| CP-TODO-231 | 011/012/030；Phase 1 | LE cohort/reviewer和完成写回；非法状态拒绝、同完成并发无重复证书/积分/里程碑、产物失败恢复。保留现有Program/Application，不迁移夏校。 |
| CP-TODO-232 | 010/012/033；220、231 | 统一可信奖励来源、幂等键及成就/里程碑记录；定义撤销补偿策略后实现，前后账与来源可解释，禁止客户端设置可信结果。 |
| CP-TODO-235 | 004/042；Phase 0、225 | SHCW契约/SDK与实际配置集成；注册/登录桥接、返回活动、允许的Core流程、证书验证旅程；过期/replay/跨域cookie/targetPath失败回归。先本地双origin，真实渠道环境另验收。 |
| CP-TODO-236 | 011/012/030/042；provider契约、231/232 | 外部学习parser/reconcile/reviewed apply按批准契约执行；重复/乱序/映射缺失/撤销更正、人工审核与幂等写回。无供应商/政策批准时保持blocked，不启用自动发证。 |

出口：内部 LE/奖励闭环和本地渠道测试通过；真实 SHCW 与外部学习分别签收，不能以本地模拟冒充供应商上线。236 被外部条件阻断时继续 Phase 3，不把整期或236虚标完成。

### Phase 3：公开能力档案与主数据运营

| 工作项 | 需求/依赖 | 范围与通过标准 |
| --- | --- | --- |
| CP-TODO-233 | 003/012/031/032；225、231/232 | 验收已存在portfolio的同意、token过期/撤销、访问上限并发、最小字段及证据解释；证书撤销/隐私变更即时影响公开结果，不缓存泄漏，也不恢复可枚举旧路由。 |
| CP-TODO-234 | 003/041/042；218、219 | Person/Institution后台及Speaker兼容回填；数据权限、重复/停用处理、dry-run和原引用稳定性、管理页面实际操作测试；生产回填另审。含 CP-TODO-242 显式条目：Person 认领（仅 VERIFIED 且未关联账号，不自动开户/发邀请）、机构代表权授予/撤销（CAS、有效期窗口、撤权即时生效、MANAGE 可委托）、Person/Institution 合并别名（mergedIntoId 链，旧 id 原引用可解析）、用途受限投影（institution_context/person_identity 白名单）。 |

出口：用户能选择性分享可验证证据，收回后立即失效；主数据治理不破坏既有活动/嘉宾展示。

### Phase 4：架构收口与发布验收

| 工作项 | 需求/依赖 | 范围与通过标准 |
| --- | --- | --- |
| CP-TODO-239 | 030/042及架构；前述稳定契约 | 形成Core领域提取ADR和接口/事务/存储依赖清单，优先迁移已稳定共享规则而非拆部署。社区/兑换/AI按现有边界回归，不新增provider、自动发布或履约。拆admin/api另有风险/回滚计划后再实施。 |
| CP-TODO-238 | 全部FR；对应已交付包 | 全量链接与角色操作清单、零关键skip的E2E、视觉、迁移dry-run/备份恢复演练、生产限流/存储/邮件/域名安全配置和监控清单。仅出具发布建议；用户未授权不执行生产迁移或部署。 |

出口：每项发布范围有实际证据，剩余blocked/non-goal显式列出。有限范围发布可以关闭未通过的非核心入口，但不能隐藏P0漏洞或把核心PDF/权限问题宣称已完成。

## 4. 每个工作包的测试门槛

1. 先写失败用例或复现步骤，再实施；每包完成跑相关 unit、真实 DB/API 与浏览器操作。阶段末再跑全局回归；失败先修复再继续，外部门槛单独登记。
2. Node mock/source断言适合快速回归，不代替数据库事务/并发、真实登录和浏览器验收。记录 passed/failed/skipped 及 skip 理由；关键验收路径必须零skip。
3. 默认基础命令：`npm test`、`npm run lint`、`npm run build`、`npm run db:validate`；仅在明确独立测试环境执行集成/E2E和迁移测试，运行前核准实际脚本及数据库标识。
4. 安全用例覆盖匿名、本人、他人、ADMIN、关联/不关联EVENT_MANAGER、分配/不分配VERIFIER，以及SUSPENDED/非ACTIVE会话；请求越权不能改变记录、奖励、产物或发送成功通知。
5. 浏览器验收包含真实注册/登录、刷新、返回链接、查询参数、加载/空/错误状态、过期会话；所有页面入口枚举，对应路由或动作无空链接，不仅验证HTTP200。
6. PDF验收读取文件类型、页数/物理尺寸并实际渲染检查；从生成产物解码QR访问验证页面，而不只测试创建二维码的函数。截图去除或使用虚构测试身份，不导出真实申请材料。
7. 每包证据记录：任务ID、FR、代码提交或工作树说明、环境/数据隔离、执行命令、结果/skip、浏览器截图和剩余风险；同步 implementation status 与 tracker。

## 5. 决策与外部依赖

| 条件 | 何时需要 | 不阻断哪些工作 |
| --- | --- | --- |
| 历史菜单顺序与当前需求顺序不一致 | 237视觉批次开始前确认，当前保持现状 | Phase 0和证书服务层 |
| 真实域名、回调/来源、cookie、SHCW凭证与测试环境 | 235真实渠道验收前 | 本地双origin契约测试 |
| PDF字体许可、私有存储部署和备份/保留策略 | 227生产方案及238前 | 本地隔离样例渲染 |
| 积分/成就撤销补偿政策 | 232补偿实现前，不默默回滚旧账 | 幂等、来源审计、越权修复 |
| 外部LMS provider/parser/对账审批 | 236开始应用阶段前 | 内部LE、档案、主数据 |
| 附件数据治理与外部邮件发送配置 | 229附件及228外部通知前 | 无附件申请、站内通知 |

最先执行 **218 -> 219/221 -> 220/222 -> 223**；依赖独立的包可并行。随后按Phase 1到4推进，每包测试通过才关闭，不重复搭建已存在的模块。

## 6. V2.1 多 Programme 基座执行进度

执行进度（2026-09-19）：CP-TODO-240/241 第一批已按上述边界完成本地交付，基准为 [字段所有权与 scope ADR](FIELD_OWNERSHIP_AND_SCOPE_ADR_V21_20260919.md)。additive 迁移 `20260919060000_multi_programme_scope_foundation` 新增 Tenant/Programme/Edition/AccessMembership/ObjectAuthorization/InstitutionRepresentation/ChannelClient/SourceObjectMapping（已应用于本地开发与隔离测试库，未部署生产）。授权服务 `apps/passport-web/lib/server/programme-scope.ts` 提供 `resolveScopedAccess(actor, scope, action, object)`：默认拒绝、未知/冲突/归档 scope 拒绝、跨 Programme/Edition 拒绝、有效期与撤权即时生效、全局角色（含 ADMIN）不自动跨 Programme；已接入 `/api/activities/[id]/institutions` 读写两个真实执行点（无映射遗留对象行为不变，夏校冻结兼容控制）；contracts 的 ChannelKey 由固定 "SHCW" 字面量扩展为可登记 key，v1 bridge/exchange 对非 SHCW fail-closed）。验收证据：`tests/programme-scope-service.test.mjs` 14 项源码级断言；`tests/api/programme-scope-authorization.test.ts` 真实数据库越权矩阵 15 项（3 虚构 Programme、2 Edition，覆盖同范围正路径、跨 Programme/跨 Edition/未知 scope/匿名/全局 ADMIN/VIEWER 写/撤权负路径、遗留对象不变）。同日全量门禁 398/398 node、API 46 通过+6 显式 skip、lint/build/db:validate 通过。剩余 CP-TODO-242（Person 认领+机构代表服务化）、243（渠道双认证/环境）、244（outbox/inbox）、245（来源映射执行层）未开始；活动/管理/证书的其余面尚未接入 scope 断言，接入名单随 246~253 逐面落地。
