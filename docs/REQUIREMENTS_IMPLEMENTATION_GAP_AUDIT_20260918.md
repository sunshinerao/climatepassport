# 需求与实现差异审查（2026-09-18）

本报告与 [开发要求和计划](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md) 配套。产品及专题文档定义目标，本报告记录当前工作树证据；不能把存在代码、通过 mock 测试或本地迁移视为生产验收。

本报告之后收到的三个programme输入已另行对照为 [多Programme需求提炼](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md) 和 [功能需求V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md)。新增隔离、私密协作/发表、机构代表和运营工作流尚未实现；原P0问题仍有效。不要用本报告的原有模块范围判断新增能力已完成。

## 1. 审查基线与证据范围

- 工作目录：`/Users/rr/Projects_AD/climatepassport`；分支 `main`；HEAD `f1035c2`。旧会话中的 OneDrive-个人路径已不存在，不能以旧路径判断当前代码。
- 审查对象包含现有未提交、未跟踪代码及文档，并非仅 HEAD。已有他人暂存/未暂存内容必须保留；本次仅整理文档，不提交、不推送、不部署。
- 已对照当前产品、架构、ID/QR、渠道、证书需求、V1 功能需求、实现状态、总 tracker、证书 tracker 及 UI 原型对齐文档。
- 同日此前检查结果：`npm test` 330 项通过；`npm run lint`、`npm run build`、`npm run db:validate` 通过；`npm run db:migrate:status` 显示本地 28 项迁移已同步。这是当时工作树的本地证据，不代表本次文档更新后重新执行全部测试，也不证明生产库状态。
- 浏览器证据仅覆盖 1440px/390px 的登录、注册页面显示及匿名后台/证书工作台登录跳转；没有完成真实注册提交、全部登录角色、所有后台操作或原型逐像素验收。
- 路由隔离探针复现了未关联活动经理导出申请资料、未分配核验员直接签到、参与记录越权写入、变更 User-Agent 获得新限流桶。探针使用 mock，不写应用数据库；仍须补真实数据库集成回归。
- Prisma 延迟执行的只读探针确认：仅创建查询 Promise 不会执行 SQL，必须 await/消费；这直接影响产物接口的 `void prisma...update()`。
- 不统计“完成百分比”：现有页面数和测试数量不能衡量完整业务闭环。

状态口径：**已有**指发现实现；**部分**指已有路径但未覆盖目标；**缺失**指所查路径未实现目标；**待验收**指实现存在但没有完整运行证据；**受门槛限制**指需要外部契约/审批；**已替代**指历史需求不应继续照做。

## 2. 必须先修的差异

2026-09-18 复核：下表四项 P0 已按 CP-TODO-218~223 修复并通过隔离数据库、单元和浏览器回归；保留原始发现用于追溯。P1 项仍开放。夏校未修改。

| 优先级 | 代码证据（相对仓库根目录） | 差异与影响 | 工作项 |
| --- | --- | --- | --- |
| P0 | `apps/passport-web/app/api/activity-checkin/route.ts` | POST 接受客户端 userId、verifiedByUserId；只有角色门槛，没有活动资源授权和参与资格闭环；参与更新为零仍触发奖励。统一 scanner 的权限修复不能覆盖此入口。 | CP-TODO-219、220 |
| P0 | `apps/passport-web/app/api/activity-participations/[id]/route.ts` | 仅按记录 ID 更新，活动经理可越范围改变参与状态、积分和同步标识；这些状态必须由服务端领域动作推导。相关 sync-passport 入口也应纳入。 | CP-TODO-219、232 |
| P0 | `apps/passport-web/app/api/activities/[id]/applications/export/route.ts` | 角色校验不足以授权指定活动；导出申请人及关联资料，未贯通 PROJECT 同意和字段最小化规则。 | CP-TODO-222 |
| P0 | `apps/passport-web/lib/server/rate-limit.ts` | User-Agent 参与主限流键，变更 UA 可以避开原桶。共享适配器已存在，问题不是“尚无共享限流”，而是稳定主体键及生产配置验收。 | CP-TODO-221 |
| P1 | `apps/passport-web/app/api/certificates/[id]/artifact/route.ts` | `void` 未消费 Prisma 更新，下载计数及部分 legacy 状态写入不执行；文件名过滤移除中文；实际返回 HTML，不是 PDF。 | CP-TODO-224、227 |
| P1 | `apps/passport-web/components/certificate-admin-prototype.tsx` | `CertificateAdminRules` 显示写死的 Active 规则，创建/配置未形成持久化工作流；签发页撤销提交空 body，与服务端 reason 要求不一致。 | CP-TODO-225、226 |
| P1 | `tests/e2e/`、`scripts/run-with-test-env.mjs`、`playwright.config.ts` | 部分关键用例跳过或依赖预先登录；测试环境可能回退普通 .env 或复用未核实服务器。不能作为“全部前后台功能正常”的证据。 | CP-TODO-218、223 |

上述 P0 为发布阻断项。夏校维持冻结，不能借修公共权限直接重构其业务；公共依赖变更必须追加夏校只读兼容回归。

## 3. 平台模块对照

以下路径以 `apps/passport-web/` 为根，另注明者除外。精确验收在配套计划中定义。

| 需求/模块 | 当前状态及入口证据 | 尚需完成或验证 | 工作项 |
| --- | --- | --- | --- |
| CP-FR-001/004 账户、会话 | 已有注册登录、重置、邮件验证及角色会话代码；`lib/server/auth.ts`、`app/api/auth/` | 真实注册到退出、非 ACTIVE 会话、过期与重放、邮箱大小写/重复账号、多角色拒绝矩阵；生产邮件不能由 mock 代证。 | 218、223、238 |
| CP-FR-002 Passport ID | 根目录 `packages/passport-core/src/index.ts` 已含生成/校验；内部 ID 分离 | 在并发开户、冲突重试、历史导入验证唯一及不变性；不重做已存在包。 | 223、239 |
| CP-FR-004/005 bridge、限流 | `lib/server/rate-limit.ts`、`app/api/channel/session/`、`app/api/v1/` 已有原子交换、配置感知适配器 | 稳定账号/来源限制、共享后端异常策略、实际跨域 cookie/redirect/一次性消耗。 | 221、235 |
| CP-FR-010 Activity 运营 | 申请、审核、参与、任务等 API/UI 已有 | 对每个资源读写和批量操作补所有权授权、字段白名单及审计；不能只测导航是否隐藏。 | 219、222、223 |
| CP-FR-020~023 QR/Verifier | `lib/server/qr.ts`、`verifier-activity.ts`、`app/api/verifier/scan/` 已有统一扫描；Event 邀请/通行证有独立增量 | 旧 direct/checkin 路径仍可绕过；须整合且保留历史数据。Activity 邀请/通行证不等同 Event 已实现能力，应独立评估。 | 220、238 |
| CP-FR-011 Learning Experience | `app/api/admin/learning-experiences/applications/[id]/status/route.ts` 已含完成后参与记录、证书、积分、里程碑写回 | 并发完成的状态条件、里程碑去重、外部产物失败一致性尚待验证；cohort/reviewer 工作流仍不足。夏校独立流程不迁移。 | 231 |
| CP-FR-012 奖励 | `lib/server/activity-rewards.ts` 与完成流程有实现 | 多入口及重放不重复记账；拒绝客户端直接设 pointsEarned/passportSynced；撤销行为必须明确补偿政策，不能暗删历史。 | 232 |
| CP-FR-030~033 证书 | 详情、验证、签发、类别、模板、记录、申请服务均有实现 | 见下方 8 模块矩阵；真实 PDF、规则、批量任务及审计可靠性未闭环。 | 224~230 |
| CP-FR-003 公开档案 | `lib/server/portfolio.ts`、`app/[locale]/portfolio/[token]/` 已有哈希令牌、同意、过期/撤销/访问次数；旧 UUID 路由返回 404 | 循证解释、并发访问上限、证书撤销即时移除、隐私设置与缓存隔离的真实回归；不新增可枚举公开人名目录。 | 233 |
| Person/Institution | `lib/server/people-master-data.ts`、后台管理、Speaker 兼容关联及 backfill 已有 | 重复合并/治理按已有契约验收；回填 dry-run、兼容历史引用；不能宣称生产已迁移。 | 234、238 |
| CP-FR-040/041 统一后台 | 共享 `components/admin-shell.tsx` 与 admin layout 已有 | 全页单壳、激活项、正确链接、mobile hamburger/focus；证书8页字体样式严格对照原型尚未整体验收。 | 223、237 |
| CP-FR-042 SHCW | 根目录 `packages/passport-contracts`、`packages/passport-sdk` 及 v1 bridge/verify 路由已有 | 非完整 Shell 上线：实际域名/回调/凭证、安全 cookie、用户旅程和失败恢复待接入测试。 | 235 |
| 外部学习 | `lib/server/external-learning.ts` 已有 provider 草稿、映射、签名收件与幂等 | 没有完成 normalization/reconcile/reviewed apply；不能收到 webhook 即发证。provider、解析政策和运营审批为外部门槛。 | 236 |
| Community/Redemption/AI | 已有边界受限的活动社区、内部兑换记账、默认关闭的管理员 AI 草稿代码 | 不等于已发布社交平台、商店/履约或推荐系统；不可自动启用外部服务。 | 239 |
| Core 架构 | 根目录 `packages/passport-core` 有稳定帮助函数，但主要业务仍在 Web server 层 | 先收敛领域规则/事务契约再分包，不为目录整齐先拆部署或复制业务。 | 239 |

工作项栏省略前缀的编号均为 `CP-TODO-`。仅“已有”不构成 release sign-off。

## 4. Certificate Hub 八模块

以当前证书需求的模块集合审查，**此表不是新的菜单重排决定**。

| 模块 | 已有 | 与最终需求差距 | 下一步 |
| --- | --- | --- | --- |
| 总览 `/admin/certificates` | 总览页面及数据加载 | 指标口径、真实错误/空状态、趋势与异常数据是否可追溯尚待逐项验收，不得用样例补运营数 | 230、237 |
| 记录 `/records` | 分页、筛选、查看/打印、复制验证链接、撤销/恢复/再生成 | 全入口状态一致、可靠审计、真实下载计数、过期行为、缺失产物恢复 | 224、225、230 |
| 签发 `/issue` | 单个签发；按邮箱批量输入并调用后端 | CSV/名单选择、逐行校验、持久任务、部分失败重试、批次通知与结果下载不完整 | 225、228 |
| 申请 `/applications` | 用户独立申请状态、补充/重提/撤回、后台通过并签发 | 详情/历史/证据上下文与分页操作体验不足；附件需先完成私有存储和访问治理 | 229 |
| 分类 `/categories` | 创建/编辑/启停；key 不可变和依赖保护 | 配置标志是否由服务层实际执行、禁用状态联动、所有 CRUD 浏览器验收 | 225、237 |
| 模板 `/templates` | 配置表单、背景/图像、字体字段和布局、预览、复制；签发快照 | 渲染预览/PDF一致、中文字体、印章/签名/QR长文边界、尺寸单位；现有 HTML 存储不等于 PDF | 227、237 |
| 规则 `/rules` | 页面壳；统一 ACTIVITY_CHECKIN 的受限自动签发另有服务 | 页面仍是静态示例而非可管理规则；课程、LE、积分等通用触发未实现；不允许展示虚假 Active | 226，后续依赖 231/232/236 |
| 验证/审计 `/audit-logs` | 日志页面与多条服务写入路径 | 部分管理动作审计 best-effort；须定义业务日志保证、分页过滤、失败和关联批次，不以 IP 精确地区虚构分析 | 230、237 |

跨模块差距：签发快照已存在，但 `lib/server/certificate-verification.ts` 仍读取当前 user/definition 名称，需保证核验所示姓名/标题与签发产物一致；页面、API、QR、下载、公开档案必须共享状态与授权判定。陌生访客持有二维码不构成下载或详细隐私访问权限。

## 5. 文档纠偏

| 历史描述 | 当前处理 |
| --- | --- |
| “下一步先新建 core / 证书页面骨架” | 基础包与页面已存在；改为授权一致性、真实行为、数据与验收补齐，避免重复建设。 |
| `/profile/[userId]/credentials` 为公开入口 | 已被同意驱动的 `/{locale}/portfolio/[token]` 替代；旧可枚举入口保持拒绝。 |
| QR 不得是 URL | 禁止的是把裸 URL/ID 当信任凭证；允许 HTTPS URL 运送高熵 opaque code/token，仍由服务端验证。 |
| 324 tests / 15 migrations | 保留历史报告时间语境；本次可引用的本地快照为 330 tests / 28 migrations。 |
| 类别/模板/申请全部 todo，下载计数 done | 改为实现已有但待验收；计数问题重开；HTML 与 PDF 明确分开。 |
| CP-TODO-194/195/196 重复代表不同任务 | 保留身份迁移任务原编号；证书申请、v1 契约、Activity 自动签发、HTML 存储分别改为 214/215/216/217。历史编号引用须同时看任务名，不能汇总为一个完成项。 |
| 原型对齐审查认为页面缺失 | 原 May 报告保留为历史；当前页面存在不代表严格还原，补完整视觉验收。 |
| `climatepassport.org` 架构示意与 `climatepass.org` 当前仓库站点口径混用 | 示例子域不是已部署事实；上线前核准 host/callback/cookie/allowlist 一张配置表，不把架构示意硬编码成实际地址。 |
| 历史菜单 1、2、3、6、5、4、7、8 与当前文档顺序冲突 | 当前代码/文档顺序暂保持 overview/records/issue/applications/categories/templates/rules/logs。本次不重新决定历史菜单意图；视觉批次开始前只确认这一项，不阻断安全修复。 |

## 6. 结论

现状是“多个业务模块已有实质实现，但安全边界、证书最终产物、真实运营动作和端到端验收未收口”，不是纯骨架，也不是可宣称所有功能正常的完成态。下一步应先关闭全部绕过入口，再完成证书真实闭环、学习/渠道写回和视觉验收，最后按发布门槛决定是否上线。夏校保持现状，外部 provider 和生产操作保持单独审批。
