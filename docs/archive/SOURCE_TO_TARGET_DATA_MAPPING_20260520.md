# Climate Passport 源到目标数据映射

## 需求解读

- 需要把原 SHCW 系统第一阶段要迁移的核心业务数据，从现有 Prisma schema 映射到未来 Climate Passport 平台的目标域模型。
- 这份映射文档的目标不是立即冻结最终 schema，而是先把“哪些表必须迁、为什么迁、迁到哪个目标域、关键字段怎么保留”讲清楚，便于下一步设计 Passport Prisma schema 和编写迁移脚本。
- 映射过程中必须保留现有成熟能力的数据连续性，尤其是用户、Passport ID、二维码标识、活动、报名、签到、邀请函、积分与关键时间戳。

## 修改方法

- 先盘点原 SHCW schema 中第一阶段相关的核心模型、枚举和关系。
- 按 Climate Passport 的目标边界拆到 Identity Hub、People Hub、Event Hub、Participation Hub、Passport Ledger 几个目标域。
- 为每个源模型列出：目标模型建议、关键保留字段、迁移注意事项。

## 修改内容

- 新增 `docs/SOURCE_TO_TARGET_DATA_MAPPING_20260520.md`
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`

## 1. 本文范围

当前仅覆盖第一阶段核心迁移范围：

1. 用户与身份
2. 用户附属机构
3. 活动与赛道
4. 议程与嘉宾
5. 报名与签到
6. 积分
7. 邀请函
8. Verifier 分配
9. Special Pass
10. Certificate Hub

以下内容暂不在本文展开：

- Learning Experiences
- News / FAQ / SiteContent
- Insights / Knowledge Hub
- 海报与内容运营层

## 2. 目标域模型总览

为减少旧 SHCW 单体语义直接带入新平台，目标侧建议按域拆分：

- `PassportAccount`: 登录账户、认证状态、密码、邮箱验证、会话关联
- `PassportProfile`: 用户公开/业务档案、Passport ID、头像、基础资料
- `PassportOrganizationProfile`: 注册用户绑定的组织资料
- `PassportEvent`: 活动主档
- `PassportEventDateSlot`: 多日活动日期片段
- `PassportTrack`: 赛道/主题维度
- `PassportRegistration`: 用户活动报名与出席状态
- `PassportCheckInRecord`: 现场核验与签到记录
- `PassportPointLedgerEntry`: 积分流水
- `PassportSpeakerProfile`: 嘉宾/主持人档案
- `PassportSpeakerRole`: 嘉宾历史职务
- `PassportAgendaItem`: 议程项
- `PassportInvitationRequest`: 邀请函申请
- `PassportVerifierAssignment`: 验证人员与活动绑定
- `PassportSpecialPassRequest`: 特别通行证申请
- `PassportCertificateCategory`: 证书分类
- `PassportCertificateTemplate`: 证书模板与样式设定
- `PassportCertificateDefinition`: 证书定义、命名与发放规则
- `PassportCertificateIssue`: 证书生成、审批、下载、状态流转
- `PassportCertificateVerification`: 证书验真记录或验真索引

## 3. 源模型到目标模型映射

### 3.1 用户与身份

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `User` | `PassportAccount` + `PassportProfile` | `id`, `email`, `password`, `status`, `role`, `staffPermissions`, `passCode`, `climatePassportId`, `points`, `emailVerified`, `resetToken`, `resetTokenExpiry`, `createdAt`, `updatedAt` | 现有 `User` 同时承担账户、档案、Passport 标识和积分摘要。新平台建议拆为账户与档案两个逻辑模型，但第一版迁移可先保留单表实现，只要逻辑边界清楚。 |
| `Account` | `PassportExternalAccount` 或兼容 NextAuth account | `id`, `userId`, `provider`, `providerAccountId`, token 相关字段 | 如果第一阶段仍用 NextAuth 或兼容迁移，此表可直接保留。 |
| `Session` | `PassportSession` 或兼容 NextAuth session | `id`, `sessionToken`, `userId`, `expires` | 仅在需要平滑迁移现有会话层时保留。通常可不迁历史会话，只迁结构。 |
| `VerificationToken` | `PassportVerificationToken` | 可不迁历史数据 | 多数情况下不需要迁历史 token 数据，只需要迁模型结构。 |

#### 用户迁移注意事项

- `id` 建议尽量保留，减少后续跨表重建成本。
- `climatePassportId` 必须原样保留，不能重新发号。
- `passCode` 如后续更换二维码策略，也必须保留兼容映射，避免旧二维码体系失效。
- `points` 当前是用户表上的汇总值，后续仍应与积分流水核对一致。

### 3.2 用户附属机构

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `Organization` | `PassportOrganizationProfile` | `id`, `userId`, `name`, `logo`, `website`, `description`, `industry`, `size`, `contactName`, `contactEmail`, `contactPhone`, `createdAt`, `updatedAt` | 这是注册用户绑定机构，不等同于公开展示机构 `Institution`。新平台应继续区分。 |

### 3.3 赛道与活动

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `Track` | `PassportTrack` | `id`, `code`, `name`, `nameEn`, `description`, `descriptionEn`, `category`, `color`, `icon`, `partners`, `partnersEn`, `order` | 赛道是活动主档元数据，应直接迁移。 |
| `Event` | `PassportEvent` | `id`, 标题/描述双语字段, `startDate`, `endDate`, `startTime`, `endTime`, 场地双语字段, `image`, `type`, `eventLayer`, `hostType`, `trackId`, `managerUserId`, `venueCheckinSecret`, 邀请函正文, `maxAttendees`, `requireApproval`, `isClosed`, `isPublished`, `isFeatured`, `isPinned`, `createdAt`, `updatedAt` | 活动是 Passport Event Hub 的核心模型，应尽量原样迁入第一版。 |
| `EventDateSlot` | `PassportEventDateSlot` | `id`, `eventId`, `scheduleDate`, `startTime`, `endTime`, `createdAt`, `updatedAt` | 保留多日活动能力。 |

#### 活动迁移注意事项

- `managerUserId` 迁移后仍应指向保留原 `User.id` 的账户记录。
- `venueCheckinSecret` 是现场自助签到关键值，必须保留。
- 邀请函正文 `invitationContentHtml_zh/en` 需要随活动一并迁移，否则邀请函渲染会丢失事件级模板覆盖能力。

### 3.4 报名、验证人员与签到

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `Registration` | `PassportRegistration` | `id`, `userId`, `eventId`, `status`, `notes`, `dietaryReq`, `checkedInAt`, `checkedInBy`, `checkInMethod`, `pointsEarned`, `createdAt`, `updatedAt` | 报名与签到状态是参与主链路数据，必须整体保留。 |
| `EventVerifier` | `PassportVerifierAssignment` | `id`, `userId`, `eventId`, `createdAt` | Verifier 与活动的绑定关系必须保留。 |
| `CheckIn` | `PassportCheckInRecord` | `id`, `userId`, `eventId`, `scannedBy`, `scannedAt`, `method`, `createdAt` | 这是现场审计记录，不能只依赖 `Registration.checkedInAt` 替代。 |
| `Wishlist` | `PassportEventWishlist` 或用户偏好子表 | `id`, `userId`, `eventId`, `createdAt` | 虽然不是主业务阻塞，但属于 Dashboard / 我的日程体验的一部分，建议一并迁。 |

#### 报名与签到迁移注意事项

- `Registration.checkedInAt` 与 `CheckIn.scannedAt` 应做一致性核对。
- `checkedInBy` 在旧系统是字符串字段，应确保迁移后能关联到实际 verifier 用户。
- 若未来把报名审核拆成更细状态机，第一阶段仍建议保留旧枚举语义兼容层。

### 3.5 积分与 Passport Ledger

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `PointTransaction` | `PassportPointLedgerEntry` | `id`, `userId`, `points`, `type`, `eventId`, `registrationId`, `description`, `createdBy`, `createdAt` | 这是用户积分可信流水，必须完整迁移。 |
| `User.points` | `PassportProfile.pointsBalance` 或冗余汇总字段 | `points` | 作为汇总值保留，但以后应以流水为准计算或校验。 |

#### 积分迁移注意事项

- 不要只迁 `User.points` 而丢失 `PointTransaction`。
- 迁移完成后应做用户积分汇总核对，确认汇总值与流水一致。

### 3.6 嘉宾、主持人、议程

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `Speaker` | `PassportSpeakerProfile` | `id`, `slug`, `salutation`, 姓名/职位/机构/简介双语字段, `avatar`, `organizationLogo`, `summary`, 国家地区字段, `relevanceToShcw`, `expertiseTags`, 联系方式字段, `isKeynote`, `isVisible`, `agendaRoleDisplayMode`, `institutionId`, `order`, `createdAt`, `updatedAt` | 你已明确嘉宾和主持人属于 Passport 平台功能与内容，应整体迁移。 |
| `SpeakerRole` | `PassportSpeakerRole` | `id`, `speakerId`, `title`, `titleEn`, `organization`, `organizationEn`, `startYear`, `endYear`, `isCurrent`, `order`, `createdAt`, `updatedAt` | 历史职务信息影响前台显示逻辑，必须保留。 |
| `AgendaItem` | `PassportAgendaItem` | `id`, `eventId`, `agendaDate`, `startTime`, `endTime`, `title`, `titleEn`, `description`, `descriptionEn`, `type`, `venue`, `speakerMeta`, `moderatorId`, `order`, `createdAt`, `updatedAt` | 议程和主持/嘉宾关联一起迁移。 |

#### 嘉宾与议程迁移注意事项

- `AgendaItem.speakers` 是隐式多对多关系，迁移时要保留连接表数据。
- `moderatorId` 是 `Speaker` 关系的一部分，应作为主持人角色保留。
- `Speaker.institutionId` 指向公开展示机构 `Institution`，若第一阶段不迁 `Institution` 全域，也应至少保留关联字段和必要数据集。

### 3.7 邀请函

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `InvitationRequest` | `PassportInvitationRequest` | `id`, `userId`, `salutation`, `guestName`, `guestTitle`, `guestOrg`, `guestEmail`, `language`, `eventId`, `purpose`, `notes`, `customMainContent`, `aiEnhancedBodyZh`, `aiEnhancedBodyEn`, `signaturePresetId`, `useStamp`, `status`, `letterFileUrl`, `rejectReason`, `createdAt`, `updatedAt` | 邀请函已是成熟业务，必须完整迁移。 |

#### 邀请函迁移注意事项

- 邀请函申请依赖活动级正文覆盖和全局模板设置，后续 schema 还需补模板配置模型盘点。
- 文件 URL 应保留，避免历史邀请函失联。

### 3.8 Special Pass

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| `SpecialPass` | `PassportSpecialPassRequest` | `id`, `userId`, `entryType`, `status`, `country`, `name`, `birthDate`, `gender`, `docNumber`, `docValidFrom`, `docValidTo`, `docPhoto`, `docPhotoBack`, `photo`, `organization`, `jobTitle`, `docType`, `email`, `phoneArea`, `phone`, `contactMethod`, `contactValue`, `adminNotes`, `reviewedBy`, `reviewedAt`, `createdAt`, `updatedAt` | 是准入/身份扩展业务，建议第二阶段早期迁移。 |

### 3.9 Certificate Hub

| 源模型 | 目标模型建议 | 必须保留字段 | 说明 |
|---|---|---|---|
| 当前无独立成熟源表 | `PassportCertificateCategory` | `id`, `key`, `name`, `nameEn`, `description`, `descriptionEn`, `order`, `isActive` | 证书分类模型，支持不同证书族。 |
| 当前无独立成熟源表 | `PassportCertificateTemplate` | `id`, `categoryId`, `name`, `nameEn`, `templateType`, `templateConfigJson`, `renderConfigJson`, `isActive`, `version`, `createdAt`, `updatedAt` | 模板设定模型，负责版式、背景、文案变量、渲染参数。 |
| 当前无独立成熟源表 | `PassportCertificateDefinition` | `id`, `categoryId`, `templateId`, `name`, `nameEn`, `issueRule`, `approvalMode`, `verificationMode`, `pointsRule`, `achievementRule`, `milestoneRule`, `isActive` | 定义证书名称、发放条件、审批要求以及与积分/成就/里程碑的联动规则。 |
| 当前无独立成熟源表 | `PassportCertificateIssue` | `id`, `definitionId`, `userId`, `sourceType`, `sourceId`, `status`, `generatedFileUrl`, `verificationCode`, `approvedBy`, `approvedAt`, `issuedAt`, `downloadCount`, `createdAt`, `updatedAt` | 证书实例记录，覆盖生成、审批、验真、下载全生命周期。 |
| 当前无独立成熟源表 | `PassportCertificateVerification` | `id`, `certificateIssueId`, `verifiedAt`, `verifiedBy`, `verificationChannel`, `result`, `metadataJson` | 验真记录，可支持公开验证与后台审核追踪。 |

#### 证书 Hub 建模注意事项

- 证书 Hub 是新平台原生模块，不依赖旧 SHCW 成熟表迁移，但必须和现有 Passport 积分、成就、里程碑模型联动。
- `PassportCertificateDefinition` 不应只是模板引用，还要表达发放条件、审批模式、验真方式。
- `PassportCertificateIssue` 必须支持下载、再次下载统计、验真码或公开验证标识。
- 证书发放后若会触发积分、成就或 milestone，应在 definition 或 issue 层保留清晰联动配置或快照。

## 4. 关键枚举映射

| 源枚举 | 处理建议 |
|---|---|
| `UserRole` | 第一阶段尽量原样保留，避免权限逻辑回归。后续再区分平台角色与渠道角色。 |
| `UserStatus` | 原样保留。 |
| `RegistrationStatus` | 原样保留并兼容。 |
| `InvitationStatus` | 原样保留。 |
| `SpecialPassStatus` | 原样保留。 |
| `SpecialPassEntryType` | 原样保留。 |
| `EventLayer`, `EventHostType` | 原样保留，后续可转平台 taxonomy。 |

## 5. 第一阶段必须保留的关系

以下关系在迁移脚本中必须明确验证：

1. `User -> Organization`
2. `User -> Registration -> Event`
3. `User -> PointTransaction`
4. `User -> InvitationRequest`
5. `User -> SpecialPass`
6. `Event -> EventDateSlot`
7. `Event -> AgendaItem`
8. `Event -> EventVerifier`
9. `Speaker -> SpeakerRole`
10. `AgendaItem -> Speaker[]`
11. `AgendaItem -> moderator(Speaker)`
12. `CertificateIssue -> User`
13. `CertificateIssue -> Definition -> Template -> Category`

## 6. 建议的迁移策略

### 6.1 第一阶段策略

- 优先保留旧主键 `id`
- 优先保留旧枚举语义
- 优先保留旧 UI 依赖的重要字段命名与返回结构
- 先把旧域数据完整搬进新平台，再逐步做语义优化

### 6.2 暂不迁移的历史数据

以下数据可不迁历史记录，只迁结构或在后续再定：

- `Session`
- `VerificationToken`
- 非第一阶段内容层表

## 7. 下一步输出物

基于本文，下一步应继续产出：

1. Climate Passport 第一版 Prisma schema 草案
2. 第一阶段迁移 SQL / 脚本方案
3. 旧 API 到新平台 API 的对照表
4. 第一阶段回归验证清单