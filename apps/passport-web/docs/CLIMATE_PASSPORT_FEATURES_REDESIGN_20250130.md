# Climate Passport 五大功能重构文档

**日期：** 2025-01-30  
**版本：** v2.0  
**范围：** `climate-passport/apps/passport-web/`

---

## 需求解读

用户要求为 Climate Passport 网站新增五项核心功能：

1. **首页 Landing Page 重构** — 国际化、高端设计，提升第一印象与品牌形象
2. **登录/注册页重构** — 使用邮箱登录/注册，参考上海气候周的字段设计（姓名、头衔、手机、国家、所属机构等）
3. **可持续夏校申请** — 登录后，用户菜单含 GCA × 云谷 2026 可持续夏校报名功能
4. **证书管理（Admin）** — 登录后，管理员菜单包含证书分类管理、证书模版管理、证书颁发等功能
5. **用户 Dashboard 页面** — 包括证书、积分、成就等，参考上海气候周气候护照功能页面

---

## 修改方法

- **CSS-First 策略**：所有新样式追加到 `globals.css`，使用 `--cp-*` 设计令牌，不引入 Tailwind
- **全宽出血设计**：利用 `margin-left: calc(50% - 50vw)` 技巧突破 `.page` 容器限制，实现全屏 hero、stats 条等效果
- **服务端组件 + Auth Guard**：所有需要认证的页面使用 `requireAuthenticatedUser` / `requireRoleAccess`，并调用 `noStore()`
- **Prisma 渐进降级**：所有 DB 操作先检查 `if (prisma)`，无 DB 时优雅降级到静态数据或空状态
- **多步骤表单**：夏校申请使用 6 步向导（客户端 state 管理），侧边栏显示进度

---

## 修改内容

### 1. `app/globals.css` — 新增约 700 行 CSS 类

新增以下模块的样式类：

| 模块 | 新增 CSS 类 |
|------|-----------|
| Landing Hero | `.landing-hero`, `.landing-hero-inner`, `.landing-hero-text`, `.landing-hero-visual`, `.passport-preview-card`, `.cert-preview-mini` 等 |
| Stats Strip | `.stats-strip`, `.stats-strip-inner`, `.stats-strip-item` |
| How It Works | `.how-section`, `.how-steps-row`, `.how-step`, `.how-step-num` |
| Feature Modules | `.feature-modules-section`, `.feature-modules-grid`, `.feature-module-card` |
| CTA Band | `.cta-band`, `.cta-band-inner`, `.button-light`, `.button-ghost-light` |
| Auth Forms | `.field-row`, `.field-row-3`, `.form-section-head`, `.form-section-toggle` |
| Dashboard | `.dash-welcome`, `.dash-welcome-top`, `.dash-avatar`, `.dash-id-tag`, `.dash-points-row`, `.dash-point-box`, `.dash-level-bar`, `.dash-section`, `.cert-card-grid`, `.cert-card`, `.dash-achievement-grid`, `.dash-achievement`, `.dash-feed` 等 |
| Summer School | `.ss-layout`, `.ss-sidebar`, `.ss-sidebar-card`, `.ss-progress-list`, `.ss-progress-item`, `.ss-form-card`, `.ss-section-header`, `.radio-card-grid`, `.radio-card`, `.check-card-grid`, `.check-card`, `.ss-nav-row`, `.ss-submit-success` |
| Admin Certs | `.cert-admin-tabs`, `.cert-admin-tab`, `.cert-mgr-grid`, `.cert-mgr-list`, `.cert-mgr-item`, `.cert-mgr-icon`, `.cert-mgr-info`, `.cert-mgr-detail`, `.badge-active`, `.badge-inactive` |

### 2. `components/platform-screens.tsx` — HomeScreen 重构

新的 Landing Page 结构：
- **`.landing-hero`**：全屏深绿色主视觉，左侧文案（kicker / h1 / 副标题 / CTA 按钮），右侧护照预览卡（积分 + mini 证书卡）
- **`.stats-strip`**：4 项关键数据横条（全宽白色）
- **`.how-section`**：三列"如何运作"步骤
- **`.feature-modules-section`**：功能模块卡片网格（可跳转）
- **`.cta-band`**：底部全宽行动号召横幅

### 3. `components/auth-form.tsx` — 注册表单增强

新增字段（仅注册表单）：
- `salutation`（称谓 select）、`name`（全名）、`title`（职称）
- `phone`（手机）、`country`（国家/地区）
- 可选机构模块（`showOrgSection` 切换显示 `organizationName` 输入框）

### 4. `app/api/auth/register/route.ts` — 注册 API 扩展

- Zod schema 新增：`salutation`, `title`, `phone`, `country`, `organizationName`（均为 optional）
- `User.create` 新增以上字段；若有机构名称，通过 `organization: { create: { name } }` 关联创建

### 5. `app/[locale]/dashboard/page.tsx` — Dashboard 页面重建

功能特性：
- **dash-welcome 卡片**：头像、用户名、CP-ID、积分行（points/certificates/events）、等级进度条
- **快捷导航**：卡片网格（护照、学习中心、夏校申请、通知、消息、管理员功能）
- **证书展示**：`cert-card-grid`，含证书图标、名称、状态标签
- **成就墙**：`dash-achievement-grid`，6 项成就（基于真实用户数据动态解锁）
- 所有数据从 Prisma 读取，无 DB 时使用降级空值

### 6. `components/summer-school-form.tsx` — 夏校申请表单组件（新建）

6 步向导表单，覆盖内容：
- Step 1: 基础信息（本人 + 监护人联系方式）
- Step 2: 气候关切（探索阶段 radio-card + 核心问题文本 + 作品集链接）
- Step 3: AI 协作（AI 角色 radio-card + AI 工具 + 盲区思考）
- Step 4: 愿景（期望文本 + 未来参与路径 check-card）
- Step 5: 后勤（语言适应度 + 行程承诺 + 资助需求）
- Step 6: 确认提交（隐私声明 + CP ID 输入 + 3 个确认框 + 提交按钮）

### 7. `app/[locale]/dashboard/summer-school/page.tsx` — 夏校页面（新建）

服务端组件，需要认证，渲染 `<SummerSchoolForm />`。

### 8. `app/api/summer-school/apply/route.ts` — 夏校提交 API（新建）

- Zod 验证全量表单字段
- 写入 `LearningExperienceApplication`（`answersJson` 字段存储完整表单数据）
- 无 DB 时静默成功

### 9. `components/admin-certificate-manager.tsx` — 证书管理组件（新建）

3 个 Tab：
- **证书分类**：左列表 + 右侧详情（含该分类的模版列表）
- **证书模版**：左列表 + 右侧详情
- **颁发证书**：收件人邮箱 + 模版选择 + 颁发按钮；右侧近期颁发记录

### 10. `app/[locale]/admin/certificates/page.tsx` — 证书管理页面（新建）

- `requireRoleAccess(locale, ["ADMIN", "EVENT_MANAGER"])` 权限控制
- 从 Prisma 读取：`CertificateCategory`（含模版计数）、`CertificateTemplate`（最近 60 条）、`CertificateIssue`（最近 20 条）
- 渲染统计 data-card 网格 + `<AdminCertManager />`

### 11. `app/api/admin/certificates/issue/route.ts` — 证书颁发 API（新建）

- 仅 ADMIN / EVENT_MANAGER 可调用
- 查找收件人用户（by email）
- 查找该 templateId 对应的活跃 definition
- 创建 `CertificateIssue`（状态 ISSUED，生成唯一 verificationCode）

### 12. `components/site-shell.tsx` — 导航栏更新

新增用户菜单链接（登录状态）：
- **夏校申请**（所有用户）→ `/${locale}/dashboard/summer-school`
- **证书管理**（仅管理员）→ `/${locale}/admin/certificates`
- 管理员入口从单按钮改为：证书管理 + 后台（原有事件管理）

---

## 验证

- `npm run build --workspace passport-web` ✅ 编译成功，无 TypeScript 错误
- 新增路由：`/[locale]/dashboard/summer-school`, `/[locale]/admin/certificates`
- 新增 API：`/api/summer-school/apply`, `/api/admin/certificates/issue`

## 夏校申请临时功能（2026-05-22）

### 需求解读
- 在正式 Climate Passport 注册/登录闭环完全上线前，开放夏校申请临时入口。
- 用户可通过公开链接直接申请；系统需自动创建或关联 Climate Passport ID。
- 申请记录必须可追溯并可在后续正式注册时自动关联到同邮箱账号。
- 需要基础防重复提交（同项目 + 同邮箱）。

### 修改方法
- 新增独立临时申请存储模型 `SummerSchoolApplication`，避免依赖既有登录态流程。
- 改造 `/api/summer-school/apply` 为公开提交接口，移除登录前置。
- 提交时按邮箱自动创建 PENDING 用户并分配 Climate Passport ID，或复用已有用户与已有 ID。
- 在正式注册接口中增加“临时账号认领”路径：当检测到 PENDING 且来源于夏校临时申请时，直接激活账号并沿用 Climate Passport ID。

### 修改内容
- 新增公开页面路由：`/learning-experience/summer-school-2026/apply`。
- Prisma 新增模型：`SummerSchoolApplication`，并补充与 `User` / `LearningExperienceProgram` / `LearningExperienceApplication` 的关联。
- `app/api/summer-school/apply/route.ts`：
  - 支持公开提交。
  - 自动创建或关联用户与 Climate Passport ID。
  - 记录临时申请。
  - 同邮箱+同项目重复提交返回 409。
- `app/api/auth/register/route.ts`：
  - 对临时 PENDING 夏校用户支持注册激活与数据关联延续。
- `components/summer-school-form.tsx`：
  - 去除对登录用户 ID 的硬依赖，兼容公开页面直接使用。

## 夏校申请页头对齐微调（2026-05-22）

### 需求解读
- 公开申请页头需要和下方申请主体共用同一套两列宽度基准，而不是单独使用三栏布局。
- 左侧标题块应严格锁定到 sidebar 的列宽。
- 中间说明文案的左边界应对齐右侧表单卡片左边界，并在右侧自适应延展到语言切换器附近。
- 语言切换器应固定在右列最右侧，形成“文案在左、切换器在右”的同列内部排布。

### 修改方法
- 将公开申请页头 DOM 从独立三栏结构调整为两列结构，直接复用 `.ss-layout` 的列宽基准。
- 在右侧主列内部增加一层横向 flex 容器，承载说明文案与语言切换器。
- 保留移动端降级逻辑，在窄屏下切回单列并允许文案换行。

### 修改内容
- `app/learning-experience/summer-school-2026/apply/page.tsx`：
  - 页头改为“标题列 + 右侧主列”两段结构。
  - 右侧主列内部按“文案 + 语言切换器”排列。
- `app/globals.css`：
  - `.ss-public-header` 与 `.ss-layout` 共享 `240px + 1fr` 两列基准。
  - `.ss-public-header-main` 使用 flex 让说明文案自适应伸展，语言切换器固定在最右侧。
  - 响应式下恢复为单列，避免窄屏挤压。

## 夏校申请页头与步骤样式修正（2026-05-22）

### 需求解读
- 左侧“可持续夏校2026”标题必须在桌面端单行显示。
- 右侧说明文案与语言切换器需要与标题文字顶部对齐，而不是与上方 label 顶部对齐。
- 左侧申请进度 6 个步骤的深色外围框线需完全去除。

### 修改方法
- 通过页头局部样式约束标题换行行为，并将右列主容器改为顶部对齐。
- 增加右列顶部偏移，使右侧内容与标题文字行顶对齐。
- 显式重置步骤按钮边框，覆盖浏览器默认 button 边框样式。

### 修改内容
- `app/globals.css`：
  - `.ss-public-header h1` 改为桌面端 `white-space: nowrap` 且取消 `max-width` 限制。
  - `.ss-public-header-main` 改为 `align-items: flex-start` 并增加顶部偏移，使说明和语言切换器顶对齐标题文字。
  - `.ss-progress-item` 增加 `border: none`，去掉步骤项外围深色边框。
  - 保留移动端回退：窄屏下允许标题与说明换行，防止横向溢出。

## 夏校申请页对齐与间距二次修正（2026-05-22）

### 需求解读
- 说明文字与语言切换器需与“申请进度”文字顶部对齐，并使用同一文字风格。
- 右侧申请信息框顶部需与左侧第一个步骤块顶部对齐。
- 6 个申请步骤块之间的垂直间距需扩大为当前的 3 倍。

### 修改方法
- 将“说明 + 语言切换器”从页头移入申请表单主列顶部行，和左侧 `申请进度` 放在同一 `ss-layout` 行内对齐。
- 主列顶部行复用 `.label` 风格，并同步语言切换器触发器的字号/字重/字距。
- 通过 `ss-layout-with-header-row` 变体为右侧表单卡增加顶部偏移，使其与左侧第一个步骤块顶对齐。
- 直接将步骤列表 `gap` 从 `4px` 调整到 `12px`。

### 修改内容
- `app/learning-experience/summer-school-2026/apply/page.tsx`：
  - 公开申请页只保留左侧标题区。
  - 将说明与语言切换器通过 `headerRow` 传入 `SummerSchoolForm`，在主列顶部渲染。
- `components/summer-school-form.tsx`：
  - 新增可选属性 `headerRow?: ReactNode`。
  - 新增 `ss-main-column` 与 `ss-main-header-row` 结构。
  - `headerRow` 存在时挂载 `ss-layout-with-header-row` 变体类。
- `app/globals.css`：
  - 新增 `ss-main-*` 样式完成顶部对齐与风格统一。
  - `ss-layout-with-header-row .ss-form-card` 添加顶部偏移用于首步骤顶对齐。
  - `ss-progress-list` 的 `gap` 调整为 `12px`。
