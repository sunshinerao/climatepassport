# Climate Passport 模块迁移矩阵

## 需求解读

- 需要把原上海气候周系统中的功能模块进一步拆清，明确哪些能力应该迁移到 Climate Passport 平台，哪些仍保留在 SHCW 主题壳。
- 迁移决策不能只停留在口头说明，需要形成可执行的模块矩阵，支持后续的排期、建模、迁移开发与回归验证。
- 已被认可且成熟的用户管理、Climate Passport、Verifier、活动报名与相关 UI，默认应按“保留迁移”处理，而不是在新平台上重做一套。

## 修改方法

- 新增一份模块迁移矩阵文档，按模块记录：模块归属、迁移优先级、迁移方式、说明。
- 文档中显式区分三类：必须迁移、第二阶段迁移、保留在 SHCW 主题壳。
- 同步更新平台待办 tracker，将“模块迁移矩阵”固化为已完成的基础工作，并补充下一步待办。

## 修改内容

- 新增 `docs/MODULE_MIGRATION_MATRIX_20260520.md`
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`

## 1. 判断原则

判断某个模块是否应迁移到 Climate Passport，采用以下规则：

1. 如果模块拥有用户、身份、活动、参与、签到、积分、成长档案等主业务数据，应迁移到 Climate Passport。
2. 如果模块只是品牌内容展示、专题包装、SEO 页面或频道内容运营，应优先保留在 SHCW 主题壳。
3. 如果模块已成熟、已验证且 UI 已被认可，迁移时以“保留实现逻辑与交互形态”为默认策略。

## 2. 模块迁移矩阵

| 原系统模块 | 当前锚点 | 是否迁移 | 优先级 | 迁移方式 | 说明 |
|---|---|---:|---|---|---|
| 认证与账户 | `app/[locale]/auth/**`, `lib/auth.ts` | 是 | P0 | 保留迁移 | 注册、登录、找回密码、重置密码、角色与会话必须归 Climate Passport 所有。 |
| 用户资料与 Dashboard | `app/[locale]/dashboard/**` | 是 | P0 | 保留迁移 | 用户中心本质属于 Passport 平台，SHCW 未来只负责壳层包装。 |
| Climate Passport 卡面与二维码 | `app/[locale]/dashboard/climate-passport`, `app/api/qrcode` | 是 | P0 | 保留迁移 | 当前 UI 成熟且认可，直接作为新平台基线。 |
| 活动通行证与我的日程 | `app/[locale]/dashboard/pass`, `app/[locale]/dashboard/schedule` | 是 | P0 | 保留迁移 | 属于活动参与记录与 Passport 能力的一部分。 |
| 活动列表、详情、报名 | `app/[locale]/events/**` | 是 | P0 | 保留迁移 + 换壳复用 | 业务主数据和流程归 Passport，但 SHCW 壳可继续包装前台展示。 |
| 验码与 Verifier | `app/[locale]/verifier`, `app/api/checkin` | 是 | P0 | 保留迁移 | 这是 Passport 平台的核心现场能力，不能留在 SHCW 作为主实现。 |
| 用户管理 | `app/[locale]/admin/users` | 是 | P0 | 保留迁移 | 用户、角色、状态、积分都应进入 Passport 平台后台。 |
| 嘉宾管理 | `app/[locale]/admin/speakers`, `/{locale}/speakers` | 是 | P0 | 保留迁移 | 你已明确嘉宾/主持人属于 Climate Passport 功能与内容。 |
| 机构管理 | `app/[locale]/admin/institutions` | 是 | P1 | 保留迁移 | 机构是人物/组织主数据的一部分，应并入 People Hub。 |
| 活动管理 | `app/[locale]/admin/events` | 是 | P0 | 保留迁移 | 活动平台归 Passport 所有，后台也应整体迁移。 |
| 赛道管理 | `app/[locale]/admin/tracks` | 是 | P1 | 保留迁移 | 作为活动元数据管理能力，跟随活动平台迁移。 |
| 邀请函申请与渲染 | `dashboard/invitations`, `admin/invitations`, `lib/invitation-*` | 是 | P0 | 保留迁移 | 属于参与和准入流程，不应留在 SHCW 壳。 |
| Special Pass | `dashboard/special-pass`, `admin/special-pass` | 是 | P1 | 保留迁移 | 属于身份与准入扩展能力，适合并入 Passport。 |
| 积分管理 | `admin/users` 中积分功能, points APIs | 是 | P0 | 保留迁移 | Points Ledger 应由 Passport 平台统一管理。 |
| Certificate Hub | 新平台新增模块 | 是 | P1 | 平台新增模块 | 需要具备证书分类、名称、模板设定、生成、审批、验证、下载，并与成就、积分、里程碑关联。 |
| 通知与用户消息 | `dashboard/notifications`, `dashboard/messages`, `admin/messages` | 是 | P1 | 保留迁移 | 用户通知属于平台用户域，可在第二阶段收拢。 |
| Learning Experiences 公共申请与管理 | `app/[locale]/learning-experience/**`, `admin/learning-experience/**` | 是 | P1 | 业务迁移 | 与 Passport 申请、里程碑、证书天然耦合，建议纳入第二阶段。 |
| Summer School 申请闭环 | 现为设计文档与 LE 演化方向 | 是 | P1 | 直接按 Passport 子域建设 | 不建议再落在 SHCW 主站，应直接归 Passport。 |
| API Keys / 对外接入 | `app/[locale]/admin/api-keys` | 是 | P1 | 平台化重构 | Climate Passport 既然是平台，对外接入与渠道认证应归 Passport。 |
| 海报生成 | `app/[locale]/admin/posters`, `lib/poster-storage.ts` | 视情况 | P2 | 选择性迁移 | 如果 Passport 承担活动运营平台能力，则可迁；否则可暂留在 SHCW。 |
| 合作计划 / Sponsorship 配置 | `admin/cooperation-plans`, `admin/sponsorship-tiers` | 视情况 | P2 | 选择性迁移 | 若其主要服务于 SHCW 商务内容，可先保留在壳站。 |
| 合作伙伴展示 | `/{locale}/partners`, `admin/partners` | 暂不优先 | P3 | 壳站保留 | 更像频道品牌与合作内容，不是 Passport 第一优先业务。 |
| News 内容 | `/{locale}/news`, `admin/news` | 否 | P3 | SHCW 保留 | 品牌传播内容，留在 SHCW 主题壳更合理。 |
| FAQ 内容 | `/{locale}/faq`, `admin/faq` | 否 | P3 | SHCW 保留 | 频道内容管理，不是 Passport 核心平台能力。 |
| Content/CMS 配置 | `app/[locale]/admin/content` | 否 | P3 | SHCW 保留 | 属于频道壳层内容运营。 |
| About / Contact / Terms / Privacy | 公共静态页 | 否 | P3 | SHCW 保留 | 品牌和合规页面，保留在 SHCW。 |
| Insights / Knowledge Hub | `admin/insights`, 相关 docs/lib | 暂不优先 | P3 | 延后判断 | 是否纳入 Passport 取决于平台是否扩展到知识成果域。 |

## 3. 优先级解释

- `P0`：必须作为第一阶段迁移范围，属于 Climate Passport 平台成立的基础。
- `P1`：建议第二阶段迁移，和平台主域有强耦合，但不是最早上线阻塞项。
- `P2`：可选迁移，取决于 Passport 平台是否同时承接更广的运营职能。
- `P3`：默认留在 SHCW 主题壳，除非未来产品边界再次扩大。

## 4. 第一阶段建议范围

第一阶段应至少覆盖以下模块：

1. 认证与账户
2. 用户资料与 Dashboard
3. Climate Passport 卡面、二维码、积分、成长记录基础能力
4. 活动、议程、报名、我的日程
5. Verifier 与签到
6. 用户、嘉宾、活动后台管理
7. 邀请函
8. Certificate Hub 基础能力

## 5. 第二阶段建议范围

第二阶段建议接续：

1. Special Pass
2. 机构与赛道管理完善
3. Learning Experiences
4. Summer School 子域
5. 用户消息与通知
6. API Keys 与开放接入能力
7. Certificate Hub 审批与验证扩展能力

## 6. 暂留在 SHCW 主题壳的内容层

以下模块默认继续由 SHCW 主题壳承担：

1. 首页与品牌叙事
2. News
3. FAQ
4. About / Contact / Terms / Privacy
5. 品牌专题与 SEO 页
6. 频道内容 CMS

## 7. 后续动作

基于本矩阵，下一步应继续产出：

1. 源系统到目标平台的数据映射清单
2. 第一版 Passport 平台 Prisma schema
3. 第一阶段迁移模块的路由与 API 对照表
4. 保留迁移模块的回归验证清单