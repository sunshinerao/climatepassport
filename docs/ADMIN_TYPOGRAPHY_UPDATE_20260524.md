# Admin Typography Update 20260524

## 需求解读
- 参考提供截图，统一后台管理页面（主内容区）的字体层级与字号，提升可读性与一致性。
- 明确约束：不修改左侧菜单（导航）相关样式与结构。
- 覆盖范围：后台总览模块、Summer School 申请管理页面、Certificate 管理页面的主内容字体规则。

## 修改方法
- 在全局样式中引入后台专用排版变量（admin typography tokens），作为统一字号基线。
- 通过更高优先级但限定作用域的选择器（以 `.proto-admin-main` 为主）覆盖主内容文字样式。
- 对 `ssa-*` 与 `cpca-*` 区块进行局部字号对齐，保持原有布局、颜色与交互逻辑不变。

## 修改内容
- 修改文件：`apps/passport-web/app/globals.css`
- 新增后台排版变量：
  - `--cp-admin-text-caption`
  - `--cp-admin-text-small`
  - `--cp-admin-text-body`
  - `--cp-admin-text-body-lg`
  - `--cp-admin-heading-card`
  - `--cp-admin-heading-section`
  - `--cp-admin-heading-page`
- 新增后台主内容排版覆盖：
  - `.proto-admin-main`、`.proto-admin-main .section-header ...`
  - `.proto-admin-main-head ...`
  - `.proto-admin-metrics ...`
  - `.proto-admin-panel*`、`.proto-admin-queue*`、`.proto-admin-modules*`
- 新增 Certificate 管理排版覆盖（主内容域）：
  - `.proto-admin-main .cpca-*` 的标题、表格、辅助文本、按钮字号对齐。
- 调整 Summer School 管理排版：
  - `.ssa-count`
  - `.ssa-btn-primary`、`.ssa-btn-link`
  - `.ssa-table`、`.ssa-table thead th`、`.ssa-table td`
  - `.ssa-fullname`、`.ssa-td-email`、`.ssa-guardian-email`、`.ssa-td-date`
  - `.ssa-td-passportid code`、`.ssa-badge`
- 未改动项（按要求保留）：
  - 所有左侧菜单/侧栏相关样式（如 `.proto-admin-sidebar*`、`.proto-admin-nav*`、`.proto-admin-subnav*`、`.proto-admin-mobilebar*`、`.proto-admin-menu-button*`、`.proto-admin-overlay*`）。

## 第二轮精调（继续 1-3）

### 需求解读
- 在第一轮统一基础上，继续完成三项精调：
  1. 拉开主标题与副文案的视觉对比。
  2. 再提升表格行高与列间距。
  3. 增强按钮与状态徽章的视觉权重。
- 约束保持不变：左侧菜单不改。

### 修改方法
- 继续在 `globals.css` 的 admin 主内容覆盖层内调整，不改页面结构与导航组件。
- 标题采用更大字号与更紧字距；副文案降一级字号并提高行高。
- 表格统一增加 `th/td` padding 并优化行高。
- 按钮与徽章提升字重、圆角与阴影/描边权重。

### 修改内容
- 主内容标题层级：
  - `.proto-admin-main .section-header h1/h2` 字号上调，行高收紧。
  - `.proto-admin-main-head h2` 字号进一步拉大。
  - `.proto-admin-main .section-header p`、`.proto-admin-main-head p` 字号回落到 body 级并提升行高。
- Certificate Admin（`cpca-*`）：
  - `.cpca-page-head h1` 上调，`.cpca-page-head p` 细化。
  - `.cpca-table th/td` 增加内边距并统一文本节奏。
  - `.cpca-btn` 与 `.cpca-badge` 提升字重和触感。
- Summer School Admin（`ssa-*`）：
  - `.ssa-table thead th` 与 `.ssa-table td` 再次增大 padding。
  - `.ssa-btn-primary` 提升字重并增加阴影层次。
  - `.ssa-badge` 提升字重、描边和胶囊形态。

## 第三轮精调（继续）

### 需求解读
- 在前两轮基础上，继续贴近截图观感，聚焦三点：
  1. 标题与副文案的间距与阅读宽度更精确。
  2. 表格列宽优先级更清晰（姓名/邮箱/状态/操作）。
  3. 移动端按钮与徽章具备更好的触达性。

### 修改方法
- 仍采用主内容限定选择器，不改左侧导航及其结构。
- 标题区通过 margin 与 max-width 微调阅读节奏。
- 在 `ssa-table` 上使用列序选择器设置关键列最小宽度。
- 在移动端媒体查询中增强按钮与徽章最小可点按尺寸。

### 修改内容
- 主内容标题节奏：
  - `.proto-admin-main .section-header h1/h2` 增加底部间距。
  - `.proto-admin-main .section-header p` 与 `.proto-admin-main-head p` 收紧最大阅读宽度。
  - `.proto-admin-main-head` 及文案间距进一步微调。
- Certificate 表格可读性：
  - `.proto-admin-main .cpca-table th` 增加行高，提升表头识别。
- Summer School 表格列优先级：
  - 通过 `nth-child` 为第 2/3/8/10 列设置最小宽度，保证核心信息优先展示。
- 移动端触达增强（`@media (max-width: 768px)`）：
  - `.ssa-btn-primary` 增加最小高度并拉满宽度。
  - `.ssa-btn-link`、`.ssa-badge` 增加最小高度并改为 `inline-flex` 居中。

## 最终收口版（继续）

### 需求解读
- 在第三轮基础上做最终一致性收口，重点是：
  1. 后台主内容卡片与标题段落的阅读节奏一致。
  2. `cpca` 与 `ssa` 两类管理表格左右边界与表头权重一致。
  3. 移动端长文案段落在主内容区不出现压缩感。

### 修改方法
- 仅通过 `globals.css` 主内容选择器做补丁，不改组件结构。
- 统一 card/header/paragraph 的行高与内边距节奏。
- 对表格首尾列补齐边距，统一视觉边界。
- 在移动端媒体查询中放开文案宽度并微调 badge 内边距。

### 修改内容
- 主内容区：
  - `.proto-admin-main .section-header` 增加 `row-gap`。
  - `.proto-admin-panel` 内边距调至 `20px`。
  - `.proto-admin-panel-head h2` 与队列/模块段落补齐行高。
- Certificate 管理表格：
  - `.cpca-table` 首列/末列补齐左右内边距，统一边界。
- Summer School 管理表格：
  - `thead th` 字重提升、标题色加强、字间距微调。
  - `td` 文本色与末列右内边距统一。
- 移动端：
  - 主内容区关键段落在 768px 以下统一 `max-width: 100%`，并微调行高。
  - `.ssa-badge` 增加横向内边距，保持触达与可读性。

## 紧急恢复与基准对齐（按反馈修正）

### 需求解读
- 用户要求将 `/admin/summer-school/applications`（夏校申请记录页）恢复为原始视觉风格。
- 在恢复该页后，以该页作为基准风格，更新其他后台主要页面主内容区。
- 左侧菜单部分保持不变。

### 修改方法
- 对 `globals.css` 中 `ssa-*` 区块进行整段回滚到原始样式参数。
- 保留并下调 `proto-admin-main` / `cpca-*` 覆盖层，使其字号和密度接近 `ssa-*` 的稳态风格。
- 不修改任何侧栏导航相关选择器。

### 修改内容
- 已恢复 Summer School 申请页样式（`ssa-*`）：
  - 恢复按钮、表格、日期、邮箱、徽章、移动端规则至原先尺度。
  - 移除后续新增的列宽强制、阴影强化、触达扩展等实验性改动。
- 已将其他后台主内容改为“参照夏校页”的克制风格：
  - `proto-admin-main` 标题/正文/指标卡字号回调。
  - `cpca-*` 的表头、表格内边距、按钮/徽章权重下调。
- 未改动项：
  - 左侧菜单与导航体系（sidebar/nav/subnav/mobilebar/menu-button/overlay）。

## 证书总览页面细节修正（按最新要求）

### 需求解读
- 页面：`/admin/certificates`。
- 需求 1：顶部导航块仅保留面包屑 `Climate Passport › 证书中心 › 证书总览`，移除下面菜单按钮，并去掉该块外框线。
- 需求 2：`证书管理总览` 标题字体与 `admin/learning-experiences` 页标题字体一致。
- 约束：左侧菜单不改。

### 修改方法
- 在证书模块导航组件中增加可配置模式 `breadcrumbOnly`。
- 仅在证书总览页启用该模式；其他证书子页保持原菜单按钮。
- 在全局样式新增 `.cpca-module-nav.is-breadcrumb-only`，用于去除外框与容器装饰。
- 调整 `.proto-admin-main .cpca-page-head h1` 的字体参数，匹配 learning-experiences 标题风格（无衬线、同级字号/字重/字距）。

### 修改内容
- 组件改动：
  - 文件：`apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateModuleNav` 新增 `breadcrumbOnly` 参数并在该模式下隐藏 `.cpca-section-links`。
  - `CertificateAdminFrame` 新增 `breadcrumbOnly` 透传。
  - `CertificateAdminDashboard` 使用 `<CertificateAdminFrame ... breadcrumbOnly>`。
- 样式改动：
  - 文件：`apps/passport-web/app/globals.css`
  - 新增 `.cpca-module-nav.is-breadcrumb-only`：去除背景、边框、圆角、内边距及模糊效果。
  - 调整 `.proto-admin-main .cpca-page-head h1`：与 learning-experiences 标题风格一致。
- 未改动项：
  - 左侧菜单相关样式与结构未改。

## 证书总览顶部对齐与面包屑链接修正（按最新要求）

### 需求解读
- 页面：`/admin/certificates`。
- 要求 1：`Climate Passport › 证书中心 › 证书总览` 与左侧“管理控制台”文字顶部对齐。
- 要求 2：其下方“证书管理总览”与左侧“Admin Workspace”文字顶部对齐。
- 要求 3：该面包屑作为可点击菜单；首段文案改为“Climate Passport 管理首页”。

### 修改方法
- 在证书总览页继续使用 `breadcrumbOnly`，并新增总览页专用容器类控制纵向间距。
- 将面包屑从纯文本改为 `Link` 链接，分别指向管理首页、证书中心首页、当前页。
- 通过面包屑链接样式统一可读性，保留当前项强调。

### 修改内容
- 组件层：
  - 文件：`apps/passport-web/components/certificate-admin-prototype.tsx`
  - 面包屑改为链接：
    - `Climate Passport 管理首页` -> `/{locale}/admin`
    - `证书中心` -> `/{locale}/admin/certificates`
    - `证书总览`（当前页） -> 当前路由并设置 `aria-current="page"`
  - `CertificateAdminFrame` 在 `breadcrumbOnly` 模式下增加 `is-breadcrumb-only-layout` 类。
- 样式层：
  - 文件：`apps/passport-web/app/globals.css`
  - 新增 `.cpca.is-breadcrumb-only-layout` 及其 page head 间距规则，控制总览页顶部对齐。
  - 新增 `.cpca-breadcrumb-link` / `:hover` / `.is-current`，实现面包屑可点击菜单与当前项强调。
- 未改动项：
  - 左侧菜单样式与结构未改。

## 证书记录页顶部菜单按钮移除（按最新要求）

### 需求解读
- 页面：`/admin/certificates/records`。
- 仅移除面包屑 `Climate Passport 管理首页 › 证书中心 › 证书记录` 下方的菜单按钮行。
- 其余视觉与行为保持不变。

### 修改方法
- 不复用 `breadcrumbOnly`（该模式会改变容器风格），新增独立参数 `hideSectionLinks`。
- 仅在 `CertificateAdminRecords` 页面透传 `hideSectionLinks`，其他证书页面不受影响。

### 修改内容
- 文件：`apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateModuleNav` 新增可选参数 `hideSectionLinks?: boolean`。
  - 导航按钮区渲染条件改为：`breadcrumbOnly || hideSectionLinks` 时隐藏。
  - `CertificateAdminFrame` 新增 `hideSectionLinks` 透传。
  - `CertificateAdminRecords` 使用 `<CertificateAdminFrame locale={locale} hideSectionLinks>`。
- 结果：仅 records 页隐藏面包屑下方菜单按钮，其他不变。

## 总览页与记录页效果统一（按结论执行）

### 需求解读
- 用户确认 `admin/certificates/records` 的顶部效果为目标样式。
- 需要将 `admin/certificates` 页面前面改动处也调整为与 records 相同样式。

### 修改方法
- 复用已验证的 `hideSectionLinks` 方案。
- 将证书总览页从 `breadcrumbOnly` 模式切换为 `hideSectionLinks` 模式，使其与 records 页显示逻辑一致。

### 修改内容
- 文件：`apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateAdminDashboard` 由
    - `<CertificateAdminFrame locale={locale} breadcrumbOnly>`
    改为
    - `<CertificateAdminFrame locale={locale} hideSectionLinks>`
- 结果：
  - `admin/certificates` 与 `admin/certificates/records` 现在采用相同顶部呈现策略：保留面包屑，隐藏下方菜单按钮行。

## 证书模块全页面统一（按最新要求）

### 需求解读
- 用户要求将 `admin/certificates/issue` 等证书相关页面也统一为当前确认样式。
- 目标样式：保留面包屑，隐藏其下方菜单按钮行。

### 修改方法
- 复用已实现的 `hideSectionLinks` 参数。
- 将证书模块其余页面对应的 `CertificateAdminFrame` 调用统一加上 `hideSectionLinks`。

### 修改内容
- 文件：`apps/passport-web/components/certificate-admin-prototype.tsx`
- 已统一页面：
  - `CertificateAdminCategories`
  - `CertificateAdminTemplates`
  - `CertificateAdminIssue`
  - `CertificateAdminApplications`
  - `CertificateAdminRules`
  - `CertificateAdminAuditLogs`
- 结果：
  - 证书模块各页面（包括已改的 `dashboard` 与 `records`）顶部样式一致：仅显示面包屑，不显示下方菜单按钮行。

## 右上角用户菜单与语言切换器对齐修正（按最新要求）

### 需求解读
- 页面右上角存在两处控件：用户按钮（管理员下拉）与语言切换器。
- 需要：
  1. 右侧管理员下拉菜单文字字体和大小与左侧菜单保持一致。
  2. 用户按钮高度、字体和大小与语言切换器一致。
  3. 用户按钮左侧圆形位置在有头像时展示用户头像。

### 修改方法
- 在 `globals.css` 中统一用户按钮与语言切换器的最小高度与字号基线。
- 将用户下拉项字号切换为与左侧菜单一致的 `var(--cp-text-small)`。
- 在 `user-account-menu.tsx` 的 `Avatar` 组件中，头像存在时渲染真实图片元素。

### 修改内容
- 文件：`apps/passport-web/components/user-account-menu.tsx`
  - `Avatar` 组件改为：有 `user.avatar` 时渲染 `<img className="account-avatar-image" ...>`；否则显示姓名首字。
- 文件：`apps/passport-web/app/globals.css`
  - `.account-menu-trigger` 最小高度调为 `40px`。
  - `.locale-trigger` 增加 `min-height: 40px`，与用户按钮对齐。
  - `.account-trigger-copy strong` 字号改为 `var(--cp-text-small)`。
  - `.account-menu-item` 字号改为 `var(--cp-text-small)`，与左侧菜单字号一致。
  - `.account-menu-panel` 增加基线字号 `var(--cp-text-small)`。
  - 新增 `.account-avatar-image`，确保头像填充圆形区域。
