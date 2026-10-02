# Climate Passport 需求与代码实现审计

日期：2026-09-19  
状态：当前正式项目工作树审计记录  
审计性质：只读审计；未修改应用代码、数据库模型、迁移或测试  

## 1. 审计结论

Climate Passport 已经不是页面骨架项目。账户、Passport ID、Activity、QR/Verifier、Certificate Hub、Learning Experience、Portfolio、Person/Institution 和 SHCW v1 接口均有不同程度的实际实现，其中证书真实 PDF、私有产物、批次签发和 Activity 权限整改已经形成较强的本地测试证据。

但当前项目仍不能认定为完整需求完成或具备生产发布条件，原因包括：

1. 证书公开验证存在资源级授权缺失，可能向无关的 Event Manager 或 Verifier 暴露扩展隐私字段。
2. 证书验证审计仍保存原始 verification code，与当前安全要求冲突。
3. V2.1 定义的多 Programme 数字基座共享层尚未实现，当前仍以全局角色和固定 SHCW channel 为主。
4. 通用私密记录、受控 Asset、证据版本、Publication 网关和可靠 outbox/inbox 尚未建立。
5. 关键证书审计仍为 best-effort，证书申请部分状态转换存在并发竞争。
6. API 和浏览器测试仍有明确 skip，不能据此声明所有前后台功能完整正常。
7. 当前开发成果大量处于未提交工作树，缺少稳定、可回滚、可交接的版本基线。

因此，当前状态应定义为：**核心功能已有实质本地实现，但安全边界、V2.1 共享底座、可靠性、全链路验收和生产发布条件尚未收口。**

## 2. 审计范围与基线

### 2.1 审计对象

- 正式项目目录：`/Users/rr/Projects_AD/climatepassport`
- 分支：`main`
- 审计时 HEAD：`f1035c2932cd47c361c801c8d7f66ac4a63f23c2`
- 审计包含：已跟踪修改、暂存内容、未跟踪代码、未跟踪迁移、测试和当前需求文档。
- 不包含：Sites 重设计原型及其代码。
- 夏校功能维持冻结，仅检查共享依赖风险，不将夏校业务改造列入整改范围。

### 2.2 需求依据

本次按以下当前权威文档进行对照：

1. [CURRENT_PRODUCT_REQUIREMENTS.md](CURRENT_PRODUCT_REQUIREMENTS.md)
2. [CURRENT_ARCHITECTURE_DECISIONS.md](CURRENT_ARCHITECTURE_DECISIONS.md)
3. [CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md)
4. [PASSPORT_ID_AND_QR_SPEC.md](PASSPORT_ID_AND_QR_SPEC.md)
5. [CHANNEL_SHELL_INTEGRATION_SPEC.md](CHANNEL_SHELL_INTEGRATION_SPEC.md)
6. [CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md](CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md)
7. [CURRENT_IMPLEMENTATION_STATUS.md](CURRENT_IMPLEMENTATION_STATUS.md)
8. [CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md](CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md)

V2.1 的边界决定继续有效：Climate Passport 只开发可复用数字基座和接入契约；Future Stewards、SHCW、Convener 等 Programme 的个性化业务层由各 Programme 独立开发。

### 2.3 工作树状态

审计时工作树共有：

- 115 个修改文件；
- 1 个新增跟踪文件；
- 2 个删除文件；
- 135 个未跟踪文件；
- 合计 253 项工作树变化。

这不代表文件错误，但意味着目前的实现证据无法仅通过 Git HEAD 重建，属于交接、回滚和发布审查风险。

## 3. 关键审计发现

### CP-AUD-001：证书扩展信息缺少资源级授权

严重级别：**P0 / 发布阻断**  
关联需求：CP-FR-004、CP-FR-031、CP-FR-033、CP-FR-050、CP-FR-051  
关联工作项：CP-TODO-225、CP-TODO-241

#### 需求

匿名或普通第三方持有证书二维码时，可以验证证书状态并查看公开白名单字段。扩展字段只能由证书所有者或对该证书、来源活动或签发业务具有明确资源授权的管理者查看。角色名称本身不能构成授权。

#### 当前实现

`apps/passport-web/lib/server/certificate-verification.ts` 中的 `isPrivilegedRole` 将以下角色统一视为可查看扩展信息的 `STAFF`：

- `ADMIN`
- `EVENT_MANAGER`
- `VERIFIER`
- `STAFF`
- `SPECIAL_PASS_MANAGER`

`resolveAccessLevel` 没有查询该账户是否管理证书来源活动、是否被分配到相关核验范围，或者是否获得证书级授权。获得 `STAFF` 后，响应可包含：

- `issueId`
- `sourceType`
- `sourceId`
- `holderEmail`
- `verificationCount`
- `queryCount`

现有测试 `tests/phase0-core-api-runtime-regression.test.mjs` 还保留了 `staff sees extended fields` 场景，但没有覆盖“无关 Verifier / Event Manager 必须只能看到公开字段”的反向测试。

#### 风险

任何无关 Verifier 或 Event Manager 只要获得证书验证链接或二维码，就可能读取不属于其工作范围的个人邮箱和内部业务引用。该行为违反最小披露和跨 Programme 隔离原则。

#### 完成标准

1. 所有者仍可查看自己的扩展字段。
2. `ADMIN` 是否拥有全局查看权必须按最新治理政策明确；新私密域不能默认继承技术管理员全局正文访问。
3. Event Manager 仅在证书来源与其被授权资源一致时获得允许字段。
4. Verifier 仅获得当前核验动作必要字段，不因角色获得证书后台扩展数据。
5. 增加匿名、所有者、无关 Event Manager、相关 Event Manager、未分配 Verifier、已分配 Verifier 的真实数据库负向矩阵。

#### 整改状态（2026-09-19）

已关闭。`certificate-verification.ts` 改为资源级授权：仅持有者与来源活动受管的 EVENT_MANAGER 获得扩展字段；ADMIN（依 CP-FR-051 无常态正文浏览）、VERIFIER（含已分配）、STAFF、SPECIAL_PASS_MANAGER 一律仅获公开白名单字段。真实数据库负向矩阵见 `tests/api/certificate-verification-authorization.test.ts`，服务级断言见 `tests/certificate-verification-service.test.mjs`。管理端后台路径（证书记录管理）不受本端点策略影响。未部署生产。

### CP-AUD-002：验证审计保存原始 verification code

严重级别：**P0 / 安全要求冲突**  
关联需求：CP-FR-020、CP-FR-033、CP-FR-068  
关联工作项：CP-TODO-225、CP-TODO-230

#### 需求

公开证书二维码使用每张证书独立的 opaque verification code。日志不得持久化原始 token/code，应记录证书内部引用或不可逆、可关联的安全摘要。

#### 当前实现

`apps/passport-web/lib/server/certificate-verification.ts` 存在以下记录：

- Preview 查询将原始 code 写入 `CoreAuditLog.subjectId`。
- Not Found 查询将用户输入的原始 code 写入 `CoreAuditLog.subjectId`。
- 有效证书查询在 `metadataJson.verificationCode` 中写入完整 code。

#### 风险

审计库、日志导出、备份或后台日志权限可能成为可用验证链接的二次泄漏面；不存在查询还允许攻击者输入内容进入审计记录。

#### 完成标准

1. 有效证书日志只保存 `CertificateIssue.id` 或 opaque audit correlation。
2. 无效代码只保存截断哈希，不保存原值。
3. 历史原始 code 日志是否清理或脱敏应形成迁移方案。
4. 测试必须断言 audit payload 不含原始验证代码。

#### 整改状态（2026-09-19）

已关闭。有效证书日志只存 `CertificateIssue.id` 且 metadata 不再携带原始 code；preview/not-found 日志 subjectId 只存 `fp:<sha256-16>` 截断指纹。历史数据由迁移 `20260919010000_scrub_certificate_verification_audit_codes` 清理（metadata 删 key、subjectId 置换为不可逆 md5 指纹）。payload 断言见 `tests/certificate-verification-service.test.mjs` 与 `tests/api/certificate-verification-authorization.test.ts`。迁移已应用于本地开发与隔离测试库，未部署生产。

### CP-AUD-003：V2.1 多 Programme 范围与授权底座缺失

严重级别：**P0 / 下一阶段架构前置条件**  
关联需求：CP-FR-050、051、052、053、069、071、073  
关联工作项：CP-TODO-240～245

#### 需求

Climate Passport 应通过 `Tenant / Programme / Edition / Channel`、scoped role、机构代表权、客户端登记及对象授权支持多个 Programme，同时确保一个 Programme 的运营身份不能访问另一个 Programme 的数据。

#### 当前实现

Prisma Schema 中未发现以下目标模型或等价通用能力：

- `Tenant`
- `Programme`
- `Edition`
- `AccessMembership`
- `ScopedRoleAssignment`
- `InstitutionRepresentation`
- `SourceObjectMapping`
- 通用对象授权或授权摘要

`packages/passport-contracts` 的 Channel 仍是固定字面量 `SHCW`。当前大量接口依赖全局 `UserRole`、Activity organizer 或 Event manager 判断，无法表达 Programme、Edition、机构委托或限时技术支持范围。

#### 风险

在此基础上直接接入 Future Stewards、Convener 或新 Programme，容易形成全局角色扩权、复制业务表、字段权威冲突或跨 Programme 数据泄漏。

#### 完成标准

按 CP-TODO-240～245 顺序完成字段所有权 ADR、scope 模型、授权服务、机构代表权、客户端登记、可靠同步和正式活动来源映射；使用至少三个虚构 Programme 和两个 Edition 进行真实数据库越权矩阵测试。

#### 整改状态（2026-09-19，更新：第六批 CP-TODO-245 交付后关闭）

已关闭（本地，未部署生产）。CP-TODO-240~245 全部交付，P0 基座条件已满足。

- CP-TODO-240 已交付：字段所有权、scoped contract 与复用原则 ADR 见 `docs/FIELD_OWNERSHIP_AND_SCOPE_ADR_V21_20260919.md`；明确不含 programme 业务规则包，CP 技术运维无常态正文浏览（CP-FR-051）。
- CP-TODO-241 已交付本地基座：additive 迁移 `20260919060000_multi_programme_scope_foundation`（已应用于本地开发与隔离测试库，未部署生产）新增 Tenant / Programme / Edition（1..n）/ AccessMembership（user × programme × edition × scoped role）/ ObjectAuthorization（对象级授权：purpose/有效期/撤销）/ InstitutionRepresentation（显式机构代表权，任职/雇佣不自动代表）/ ChannelClient（machine identity + scoped contract + 双 origin，secret 仅存引用）/ SourceObjectMapping（sourceSystem+sourceEditionRef+sourceObjectId 唯一 + 来源版本 + 来源方权威字段白名单）。全部可空 additive，不破坏现有数据；夏校行为不变。
- 授权服务 `apps/passport-web/lib/server/programme-scope.ts`：`resolveScopedAccess(actor, scope, action, object)` 默认拒绝；未知/停用 scope、edition 与 programme 不一致、归档 Edition 拒绝；跨 Programme、跨 Edition 读写拒绝；有效期窗口与撤权即时生效；全局 UserRole（含 ADMIN）不自动跨 Programme。最小真实接入点：`/api/activities/[id]/institutions` 的 GET（读）与 POST（写，位于 canManageActivity 之后）对绑定 scope 的活动执行断言；无映射遗留对象行为不变。其余活动/管理/证书面尚未接入（剩余面在实现报告中列明）。
- contracts 兼容改造：`ChannelKeySchema` 由固定 `"SHCW"` 字面量扩展为可登记 key 模式（SHCW 仍有效）；v1 bridge/exchange 对非 SHCW key 保持 fail-closed（CHANNEL_DISABLED）。
- 测试：`tests/programme-scope-service.test.mjs` 14 项源码级断言（默认拒绝/未知 scope/跨 Programme/跨 Edition/角色层级/有效期/对象级授权/机构代表权/遗留对象放行）；`tests/api/programme-scope-authorization.test.ts` 真实数据库越权矩阵 15 项（3 虚构 Programme、2 Edition：同范围读写正路径含 ObjectAuthorization、跨 Programme/跨 Edition/停用 scope/匿名/全局 ADMIN/VIEWER 写/撤权即时失效负路径、遗留无映射对象含匿名访问行为不变）。当日全量门禁：398/398 node、API 46 通过+6 显式 skip、lint/build/db:validate 通过。
- 剩余：CP-TODO-242（Person 认领 + InstitutionRepresentation 服务化）已于当日第二批交付：迁移 `20260919070000_person_institution_governance`（Person/Institution `mergedIntoId` 合并链），治理服务 `lib/server/person-institution-governance.ts`（认领仅 VERIFIED+未关联且不开户不发邀请；代表权授予/撤销 CAS + 有效期窗口 + MANAGE 委托；合并在同事务迁移全部引用并保留源记录可解析；institution_context/person_identity 白名单投影），消费端 `GET /api/institutions/[id]` 与管理端治理路由、管理端详情读取合并链解析；真实数据库矩阵验证"任职-only 403、READ 不能授权、撤权即时 403、过期窗口 403、合并旧 id 双端可解析"（`tests/api/person-institution-governance-api.test.ts` + 9 项源码级断言）。243（渠道用户/机器认证、scope 契约/SDK）已于当日第三批本地交付：contracts 增加 scope 目录与三个认证错误码，迁移 `20260919080000_channel_client_machine_auth` 以 sha256 摘要校验机器密钥（明文绝不入库），`lib/server/channel-client-auth.ts` 默认拒绝（未知/停用/USER_FACING 401、密钥不匹配 401、scope 403、origin allowlist 403），v1 证书验证路由新增向后兼容机器认证分支（无头 legacy 行为不变、携带但无效 fail-closed），管理端登记/更新/撤销路由与 SDK 机器凭据辅助落地；真实数据库矩阵覆盖撤销即时失效、scope 收紧、origin 矩阵与 legacy 不变（`tests/api/channel-client-auth-api.test.ts` + 4 项源码级断言）。真实渠道环境验收（双 origin、真实域名 cookie/CSRF/回调/退出）随 235 真实验收另行进行。244（outbox/inbox、幂等/receipt/对账）已于当日第四批本地交付：迁移 `20260919090000_reliable_outbox_dispatch`（`OutboundDispatch` 幂等键+内容哈希、租约 CAS、退避、死信、回执、revision 护栏；`channel_clients.callbackUrl`），证书撤销/恢复在同一事务入队（取消/撤权优先，payload 不含验证码等敏感字段），默认 HTTP 传输携带幂等/版本头，管理端处理/重投/对账路由与审计齐备；端到端证据含进程内真实 HTTP 接收器（`tests/api/reliable-dispatch-api.test.ts` + 7 项源码级断言）。接收侧 inbox 校验（签名/时间窗/去重）为接收 Programme 契约责任。当日第五批 Wave 1 已交付 CP-TODO-247/248/249/250/251（通用私密记录/受控 Asset/同意/外部决定回执/Publication 网关，详见 CP-AUD-004 整改状态），进一步加厚多 Programme 协作与发布底座。第六批已交付 CP-TODO-245（来源映射执行层，CP-FR-053）：迁移 `20260919140000_source_activity_execution`（contentHash + 每活动一条 ACTIVE 映射的部分唯一索引）；服务 `lib/server/source-activity-mapping.ts`（bind 三元组唯一 + 幂等键内容哈希去重/冲突 + 并发首接入 winner 重读；apply 数字段感知版本序，v3 后 v2 一律 409 SOURCE_MAPPING_STALE，同版同内容幂等/异内容 409，事务内 CAS；publish 不可变版本投影 + 撤回版本禁止复活 + 旧来源版本拒绝；cancel 取消优先——活动 CANCELLED + 撤回全部已发布版本 + 扇出，幂等；关键写入与审计同事务）；CP 侧守卫（PATCH 来源权威字段 409 ACTIVITY_SOURCE_FIELD_CONFLICT、报名门 ACTIVITY_SOURCE_NOT_PUBLISHED/CANCELLED，未映射活动行为不变）；机器门面 `/api/external/activity-mappings`（scope channel:activities:source）+ 管理端列表；contracts schema 与六个错误码；跨 Programme 寻址以 clientKey 隔离。证据：`tests/source-activity-mapping.test.mjs` 25 项源码级 + `tests/api/source-activity-mapping-api.test.ts` 13 项真实数据库矩阵；当日全量门禁 507/507 node、API 121 通过+7 显式 skip、lint/build/db:validate 通过。至此本条关闭；真实渠道环境与生产部署仍随 235/238 另行验收。

### CP-AUD-004：通用私密记录与受控证据资产缺失

严重级别：**P1 / 新 Programme 接入阻断**  
关联需求：CP-FR-057、058、060、061、068、071  
关联工作项：CP-TODO-247～251

#### 当前实现

`ActivitySubmission` 当前直接保存：

- `fileUrls: String[]`
- `linkUrl`
- 可变 `textContent`

提交 API 接受客户端传入的上述字段，没有形成统一的：

- 上传/finalize 流程；
- 实际 MIME、大小和完整性检查；
- 安全扫描状态；
- 不可变 EvidenceVersion；
- 衍生文件权限继承；
- 对象级协作授权；
- 版本冲突检查；
- Publication 和撤回网关。

#### 风险

现有 Submission 只能作为 Activity 内的早期业务记录，不能被提升为 Programme 间共享的证据服务，也不能承载青年作品、共同作者材料或需要撤回控制的公开内容。

#### 完成标准

新增通用 `ScopedRecord / Asset / EvidenceVersion / CollaborationGrant` 能力，并通过恶意文件、错误 MIME、扫描失败、版本竞争、撤权、衍生文件和跨 Programme 访问测试。不得把 Programme 的 Inquiry、导师流程或编辑工作台搬入 CP。

#### 整改状态（2026-09-19，Wave 1：CP-TODO-247/248/249/250/251）

已关闭（本地）。迁移 `20260919100000_private_records_consents_publications`（Wave 1 表结构，当日上午已预建并应用）+ `20260919120000_object_authorization_personal_scope`（ObjectAuthorization.programmeId 可空 = 个人记录对象授权）+ `20260919130000_external_receipt_content_hash`（回执内容哈希与有效期），已应用于本地开发与隔离测试库，未部署生产。

- **私密记录**：`lib/server/private-records.ts` 通用 ScopedRecord + 不可变 RecordRevision；默认 Private，所有者 > ObjectAuthorization 对象授权（用途 + 有效期，多条取最高权限）> Programme 成员（resolveScopedAccess）；更新 compare-and-set（409 不覆盖）；撤回后非所有者 404。不含 Inquiry/ActionPlan 业务模型与页面。
- **受控 Asset**：`controlled-asset-storage.ts`（local/http 内容寻址存储、回读完整性）+ `controlled-assets.ts`：magic-bytes 嗅探拒绝错误/恶意 MIME、大小+sha256 完整性校验、JPEG EXIF/PNG eXIf 定位元数据剥离、finalize 扫描门禁（PENDING 不可用/INFECTED 隔离/管理端检疫）、不可变 EvidenceVersion、衍生文件继承原始资产权限（仅原始→衍生方向）。
- **同意**：`consents.ts` 多目的（账户条款/项目运行/影像/署名/联系/推荐宣传，互不复用）、监护代授须 guardianUserId==grantor + 验证依据 evidenceJson（联系邮箱不构成授权）、版本化取代、撤回即时阻断依赖发布、频道与对象匹配规则（null=通用）。真实未成年人启用仍需获批政策。
- **外部决定回执**：`external-decision-receipts.ts` 机器认证最小回执（issuer=登记客户端），内容哈希仅覆盖 7 个内容字段（幂等键不参与）——同键同内容去重、同键异内容 409、旧 revision 409 RECEIPT_STALE；最新决定须 APPROVED 且未过期（反馈/撤销不构成批准）。
- **Publication 网关**：`publication-gateway.ts` 不可变版本投影（同版本同内容幂等/异内容 409）、已撤回版本禁止复活（409，必须发新版）、发新版不下架有效旧版、fail-closed 公开读门（no-store）、同意门（缺失/撤回分码）与可选 approvalReceipt 批准回执门（路由已透传）、发布/撤回同事务向 dispatch:publications 订阅者扇出定位级 payload（无正文）。
- **测试证据**：源码级 64 项（private-records 8 / controlled-assets 19 / consents 12 / receipts 11 / publication-gateway 14，含恶意 MIME、完整性失败、扫描失败、版本竞争 CAS、撤权即时、衍生继承、跨 Programme 拒绝）；真实数据库 API 矩阵 5 个文件（private-records/controlled-assets/consents/external-decision-receipts/publication-gateway）。当日全量门禁见计划文档执行进度。

### CP-AUD-005：关键证书审计仍可能丢失

严重级别：**P1 / 可信性缺口**  
关联需求：CP-FR-033、066、070  
关联工作项：CP-TODO-230、244

#### 当前实现

证书签发、撤销、恢复和重新生成的部分审计调用使用 `void writeCoreAuditLog(...).catch(...)`。业务写入成功后，即使审计失败，接口仍返回成功。

#### 风险

可能出现“证书状态已改变，但可信审计不存在”的情况，后台无法可靠重建操作历史，也无法对失败进行恢复。

#### 完成标准

关键业务写入与 outbox 记录同事务提交；审计消费者可重试、可对账、可观察失败。若暂不引入 outbox，至少必须让关键状态转换在审计持久化失败时明确失败或进入待恢复状态。

#### 整改状态（2026-09-19）

已关闭（采用"同事务提交"路径，未引入独立 outbox 表——审计与业务同库，同事务即可原子持久化）。单个/批次签发（`certificate-issuance.ts`）、撤销、恢复、再生成、申请审核裁决的审计全部改为与业务写入同一事务：审计持久化失败整笔回滚并返回明确 500（"No state was changed."），不再出现"状态已改但审计缺失"。再生成顺带从普通 update 改为条件更新，消除覆盖并发撤销/恢复的竞争。证据：`tests/api/certificate-application-review-api.test.ts`、`tests/phase0-core-api-runtime-regression.test.mjs`（注入审计存储失败断言 500 与无副作用）、`tests/certificate-records.test.mjs`（生命周期路由事务审计断言）。证书可见性切换与模板复制属非关键路径，保留 best-effort 并在此明示。未部署生产。

### CP-AUD-006：证书申请部分审核动作存在并发竞争

严重级别：**P1 / 状态一致性**  
关联需求：CP-FR-030、033  
关联工作项：CP-TODO-229

#### 当前实现

`APPROVE_AND_ISSUE` 已有事务和唯一性保护，但 `REQUEST_INFORMATION` 与 `REJECT` 采用：

1. 事务外读取当前状态；
2. 确认状态为 `SUBMITTED`；
3. 事务内按 ID 普通更新；
4. 写入事件、通知和审计。

更新没有附带 `status = SUBMITTED` 条件。两个并发请求可能都通过前置读取，并分别写入不同状态及重复通知。

#### 完成标准

所有审核动作使用 compare-and-set 或串行化事务；竞争失败返回 409，且只产生一条最终状态事件、一组通知和一条关键审计。

#### 整改状态（2026-09-19）

已关闭。`REQUEST_INFORMATION`/`REJECT` 改为事务内 compare-and-set（`updateMany` 条件 `status = SUBMITTED`，`count = 0` 即 409），事件、通知与审计同事务且恰好一条；`APPROVE_AND_ISSUE` 原有 Serializable 事务与 P2002/P2034 处理保持不变。真实数据库并发证据见 `tests/api/certificate-application-review-api.test.ts`（一胜一负 200/409，事件/通知/审计各一条，重复审核 409），路由级 mock 证据见 `tests/phase0-core-api-runtime-regression.test.mjs`（新增 13 项审核/审计场景）。未部署生产。

### CP-AUD-007：端到端验收仍有关键 skip

严重级别：**P1 / 发布证据不足**  
关联需求：CP-FR-041、072、073  
关联工作项：CP-TODO-223、237、238、258、259

#### 本次执行结果

| 检查 | 结果 |
| --- | --- |
| `npm test` | 366/366 通过，0 skip |
| `npm run lint` | 通过，0 warning/error |
| `npm run db:validate` | 通过 |
| `npm run db:migrate:status` | 本地 31 项迁移已同步 |
| `npm run test:api` | 16 通过，7 skip |
| `npm run test:e2e` | 27 通过，14 skip |

#### 主要跳过范围

- 活动报名；
- 真实 QR 签到及签到结果回看；
- 用户证书列表和详情；
- 证书分享和撤销分享；
- Portfolio 创建、分享和公开访问；
- 社区发帖、评论和审核；
- 积分预占及兑换结算占位接口。

现有 137 个页面文件、145 个 API route 文件，但浏览器测试只有 9 个 spec 文件，API 集成测试只有 4 个文件。Node mock/source 测试覆盖较广，但不能替代全部真实路由、数据库和浏览器流程。

#### 完成标准

发布范围内关键旅程必须零 skip；未实现功能应关闭入口或明确标记不在本次发布范围，不能用 skip 计为通过。

### CP-AUD-008：工作树缺少稳定版本基线

严重级别：**P1 / 工程治理风险**

当前大部分新增迁移、contracts、services、API、E2E 和需求文件仍未提交。当前 HEAD 不能重建审计时通过测试的状态。

#### 完成标准

1. 先按安全修复、证书 Phase 1、Portfolio/主数据、外部学习、社区/AI/兑换边界、V2 文档等工作包拆分提交。
2. 每个提交记录对应 CP-FR、CP-TODO、迁移和测试证据。
3. 不将夏校业务改动混入共享能力提交。
4. 提交前再次运行完整门禁，并记录 commit SHA。

### CP-AUD-009：实现状态文档存在历史描述漂移

严重级别：**P2 / 交接风险**

`CURRENT_IMPLEMENTATION_STATUS.md` 前部已经说明 PDF、最小公开披露和批次签发已实现，但后续 Pending 段落仍将部分相同能力写为未实现或待扩展。测试数量也同时保留 337、366 等不同时间快照。

#### 完成标准

后续文档维护应区分：

- 已实现并本地验收；
- 已实现但生产未部署；
- 部分实现；
- 外部条件阻断；
- 明确不属于 CP；
- 历史记录。

历史数字可以保留，但必须标注日期，不能与当前结论混在同一状态列表中。

## 4. 模块开发状态

| 模块 | 当前判断 | 主要剩余工作 |
| --- | --- | --- |
| 账户、注册、登录、会话 | 本地基本完成 | 生产邮件、域名/cookie、真实部署验收 |
| Passport ID | 已实现 | 导入/生产唯一性和长期不变性验收 |
| Activity 权限与签到 | 已有实质闭环 | 报名/候补/期次、正式来源映射、Activity 邀请通行证 |
| QR / Verifier | Event 场景基本完成 | 资源级披露、key rotation、Activity pass、生产限流配置 |
| Certificate Hub | CP-TODO-224～228 本地基本完成 | CP-AUD-001/002、申请审核、可靠审计、八模块视觉和移动验收 |
| Learning Experience | 部分完成 | cohort、reviewer、成就写回、失败补偿和并发验证 |
| Points/Achievements/Milestones | 部分完成 | 统一可信来源、撤销补偿、完整规则编排 |
| Portfolio | 服务和页面已有 | 真实用户浏览器流程、并发访问上限、即时撤回和缓存隔离 |
| Person / Institution | 兼容模型和后台已有 | 认领、机构代表权、合并别名、授权投影和生产回填 |
| 外部学习 | 仅收件和配置边界 | parser、reconcile、人工 reviewed apply；无批准 provider 时保持关闭 |
| Channel SDK | SHCW v1 基础完成 | 多客户端登记、机器身份、scope、双 origin 和真实渠道验收 |
| V2.1 多 Programme 基座 | 需求阶段 | CP-TODO-240～253、257～259 |
| Programme 个性化业务 | 不属于 CP | 由各 Programme 独立开发并通过 CP 契约接入 |
| 夏校 | 冻结 | 不修改现有业务状态；共享依赖变更只做兼容回归 |

## 5. 发布判断

### 当前可以确认

- Node 单元和源码级回归当前通过。
- Activity 关键越权修复已有真实数据库浏览器测试。
- 证书真实 PDF、私有产物、下载计数、生命周期和批次签发具有较强本地证据。
- 注册、登录、退出、密码恢复、邮箱验证和非 ACTIVE 会话具有浏览器证据。
- Prisma Schema 有效，本地数据库迁移处于同步状态。

### 当前不能确认

- 不能确认生产环境已经执行这些迁移或安全配置。
- 不能确认生产邮件、对象存储、PDF renderer、共享限流和域名/cookie 已验收。
- 不能确认所有页面、按钮和角色操作均已通过浏览器测试。
- 不能确认 Certificate Hub 八模块已经严格完成原型字体、间距和四尺寸验收。
- 不能确认 SHCW 或其他 Programme 已完成真实双系统联调。
- 不能确认 V2.1 多 Programme 范围隔离已经实现。

结论：**当前不建议作为完整 Climate Passport 数字基座发布。可以继续作为本地开发与分模块验收基线，但必须先关闭 CP-AUD-001 和 CP-AUD-002，再进入多 Programme scope 层开发。**

## 6. 建议处理顺序

1. 修复 CP-AUD-001、CP-AUD-002，并增加证书资源级授权和日志脱敏测试。
2. 完成 CP-TODO-229、230，修复审核并发和可靠审计。
3. 将当前 253 项工作树变化整理为可审查、可回滚的分阶段提交。
4. 执行 CP-TODO-240 字段所有权 ADR，再实施 241～245 的 scope、授权、客户端和来源映射基础。
5. 实施 247～251 的通用私密记录、Asset、同意和 Publication 网关。
6. 补齐发布范围内零 skip 的 API/E2E、移动端、链接、迁移和恢复验收。
7. 生产配置、迁移和部署必须另行授权，不以本地测试结果自动执行。

## 7. 范围保护

- 不修改或迁移当前夏校业务流程。
- 不在 CP 内开发 FS Inquiry/导师/编辑工作台。
- 不在 CP 内开发 Convener 席位、年度激活、Offer-Need、支持工单、Credit 或 Standing。
- 不把 Programme 业务角色直接映射为 CP 全局权限。
- 不把外部审核结果自动转换为证书、积分或公开记录。
- 不把页面存在、mock 通过或本地迁移视为生产完成。

