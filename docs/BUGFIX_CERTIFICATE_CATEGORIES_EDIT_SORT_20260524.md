# Certificate Categories 功能修复记录（2026-05-24）

## 需求解读
- 分类列表中的“编辑”按钮需要真正生效，点击后下方表单应切换为当前分类的编辑态。
- “分类 Key”需要明确语义：它是系统稳定标识，不只是展示文本；交互上要支持可选项并允许扩展。
- 中文名称填写后，如果英文名称为空，应由系统自动给出英文回填建议。
- 排序字段需要支持“默认自动序号”和“人工指定序号”两种策略。
- 分类列表需要支持两种 Top5 视图：按最新、按发证最多。

## 修改方法
- 前端侧在分类列表组件中引入编辑状态与排序模式状态，实现“列表 -> 表单”的联动。
- 表单侧扩展为创建/编辑复用组件，新增 Key 预设+自定义输入、英文自动回填逻辑与编辑取消逻辑。
- 后端侧调整分类 payload 校验与写库逻辑，允许排序为空并在创建时自动补序号。
- 页面数据装配侧增加发证统计聚合字段，给 Top5 排序视图提供数据支撑。

## 修改内容
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateAdminCategory` 增加 `order`、`createdAt`、`issuedCount` 等字段。
  - `CertificateAdminCategories` 支持 `latest` / `most-issued` 两种排序模式，并只显示 Top5。
  - 编辑按钮绑定事件，点击后将选中分类传递给下方表单。
  - 表单标题动态切换为“新增分类 / 编辑分类”。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - `CertificateCategoryForm` 支持 `initialCategory`（编辑态）与 `onCancelEdit`。
  - 新增“分类 Key”预设选择 + 自定义输入（保留 slug 正则约束）。
  - 新增中文名称驱动的英文名称自动回填（仅在英文为空且未手动编辑时触发）。
  - 排序输入支持留空，留空时交由后端自动分配序号。
  - 提交 payload 在编辑态包含 `id`，复用现有 create/update API。
- 更新 `apps/passport-web/app/[locale]/admin/certificates/categories/page.tsx`
  - 增加 category 维度发证统计（通过 definition 的 issues 计数聚合）。
  - 将 `issuedCount`、`order`、`createdAt` 映射到页面组件。
  - 将 `form` 从静态节点改为回调函数，接收当前编辑分类并渲染编辑态表单。
- 更新 `apps/passport-web/lib/server/admin-certificates.ts`
  - `certificateCategoryPayloadSchema.order` 调整为可空/可缺省。
  - `buildCertificateCategoryWriteData` 支持外部传入 `overrideOrder`，仅在存在值时写入排序。
- 更新 `apps/passport-web/app/api/admin/certificates/categories/route.ts`
  - 创建分类且未传 `order` 时，自动读取最大序号并设置为 `max + 1`。
  - 编辑分类时保留现有顺序（除非显式传入人工顺序）。

## 需求解读（增量：列表检索与交互细节）
- 分类列表需要支持通过“分类/名称”检索。
- 排序选择器需在过滤区右对齐。
- 列表中的“英文名”列改为“名称”，并按当前语言显示本地化名称。
- 分类 Key 的说明文案不再固定展示，改为字段名后 `i` 图标悬浮提示。

## 修改方法（增量）
- 在分类管理组件中增加 `searchKeyword` 状态，并在列表渲染前进行关键字段过滤。
- 将过滤区拆为“左侧搜索 + 右侧排序”，通过样式类控制右对齐。
- 名称列统一使用 `localName(locale, category)` 渲染。
- 将 Key 字段说明从 `<small>` 文本迁移为 `data-tooltip` 悬浮提示图标，并增加 hover/focus 可访问样式。

## 修改内容（增量）
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 新增分类搜索输入（按 key / 中文名 / 英文名 / 本地化名称匹配）。
  - 排序选择器右对齐布局。
  - 表头“英文名”改为“名称”，内容改为按语言显示。
  - 无匹配数据时展示空结果提示。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 移除 Key 字段下方常驻说明文字。
  - 在字段名后新增 `i` 信息图标，悬浮/聚焦显示说明。
- 更新 `apps/passport-web/app/globals.css`
  - 新增 `.cpca-filter-right` 及过滤区标签布局样式。
  - 新增 `.field-label-with-info`、`.field-info-icon` 及 tooltip 动效样式。

## 需求解读（增量：过滤栏文案与字段对齐）
- 分类列表过滤栏中的“搜索”“列表视图”文案需要移除，仅保留输入控件。
- 编辑/新增分类表单里，“排序”输入框要与“分类 Key”输入区保持稳定对齐。
- “排序”输入框高度需与“分类 Key”输入控件一致。

## 修改方法（增量）
- 在分类列表过滤栏移除可见标签文字，并补充 `aria-label` 保持可访问语义。
- 在分类表单首行增加专用布局类，使用行级对齐策略稳定两列垂直对齐。
- 为 Key/Order 控件增加专用类并统一最小高度为同一基线值。

## 修改内容（增量）
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 移除过滤栏可见文案“搜索”“列表视图”。
  - 为搜索输入与排序选择器添加 `aria-label`。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 分类首行改为 `category-key-order-row`。
  - Key 与 Order 控件增加 `category-key-control` / `category-order-control` 类。
- 更新 `apps/passport-web/app/globals.css`
  - 过滤栏标签容器 `gap` 调整为 0，避免移除标题后产生额外空隙。
  - 为 `.field select` 增加与输入框一致的最小高度。
  - 新增 `category-key-order-row` 的底对齐策略与控件等高规则。

## 需求解读（增量：tooltip 对齐与排序位移）
- 鼠标悬停在 `i` 图标时，说明框需从图标位置开始左对齐显示，而不是居中展开。
- “排序”字段应固定与“分类 Key”第一行输入控件对齐，不应因选择“自定义 Key”出现第二输入框而下移。

## 修改方法（增量）
- 调整 tooltip 的定位锚点，从中心锚点改为左侧锚点。
- 将分类首行布局改为顶部对齐，并通过独立字段类为“排序”列提供固定顶部偏移，锁定到 Key 第一行控件轨道。

## 修改内容（增量）
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 为首行两列增加结构类：`category-key-field`、`category-order-field`。
- 更新 `apps/passport-web/app/globals.css`
  - `.field-info-icon::after` 的 `left` 改为 `0`，取消 `translateX`，实现左起点对齐。
  - `category-key-order-row` 改为顶部对齐。
  - 新增 `category-key-field` / `category-order-field` 的对齐与顶部偏移规则，保证排序输入框稳定对齐 Key 第一控件。

## 需求解读（增量：字段名强对齐）
- 不采用“控件强制对齐”方案。
- 需要“分类 Key”与“排序”字段名先强对齐，再让下方输入框自然保持对齐。

## 修改方法（增量）
- 去掉“排序”字段的人为顶部偏移，撤销控件锚定方案。
- 在首行专门约束字段名容器（普通 `span` 与 `field-label-with-info`）使用一致的行高与最小高度，实现字段名强对齐。

## 修改内容（增量）
- 更新 `apps/passport-web/app/globals.css`
  - 移除 `category-order-field` 的 `padding-top` 偏移规则。
  - 新增 `category-key-order-row` 下字段名统一样式，使“分类 Key / 排序”文本严格同轨对齐。

## 需求解读（增量：保存分类误报网络错误）
- 新增分类点击保存后出现“网络错误”，需要改为可定位的真实错误提示。
- 目标是避免后端异常或非 JSON 响应被前端统一误判为网络问题。

## 修改方法（增量）
- 后端分类保存接口增加统一 `try/catch`，对 Prisma 已知错误返回明确 JSON 错误码与文案。
- 前端提交逻辑改为“按响应类型解析”：仅在 JSON 响应时 `response.json()`，否则读取文本作为失败信息。

## 修改内容（增量）
- 更新 `apps/passport-web/app/api/admin/certificates/categories/route.ts`
  - 增加 `try/catch` 异常兜底。
  - 对 Prisma `P2002`（唯一键冲突）返回 `409` 与 `Category key already exists.`。
  - 对 Prisma `P2025`（更新目标不存在）返回 `404`。
  - 其他异常统一返回 `500` 与 `Failed to save category.`。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 提交后按 `content-type` 解析返回内容，避免非 JSON 触发解析异常。
  - 失败时优先显示后端返回的明确错误，而非落入“网络错误”。

## 需求解读（增量：重复 Key 错误文案）
- 用户保存分类时出现英文提示 `Category key already exists.`，需要在中文环境提供可读中文提示。

## 修改方法（增量）
- 在分类表单提交逻辑中增加错误文案本地化映射函数。
- 对已知后端错误消息（重复 Key、分类不存在、保存失败）做中英转换，未知消息原样透传。

## 修改内容（增量）
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 新增 `localizeCategorySaveError(...)`。
  - 将保存失败展示逻辑改为本地化错误消息输出。

## 需求解读（增量：内置分类自动维护）
- 内置分类 Key 需要自动维护到数据库中，避免手工逐个创建。
- 在新增/编辑分类表单中，选择内置分类 Key 后应自动进入该分类的维护模式：可修改其信息并保存，而不是报重复 Key 错误。

## 修改方法（增量）
- 在分类管理页面服务端加载流程中，对内置分类执行 `upsert`，确保缺失项自动创建到数据库。
- 在分类表单中引入分类列表上下文：当用户选择内置 Key 时，自动匹配数据库已有分类并切换到编辑态（回填当前信息）。
- 保存时依据当前激活分类决定 create/update（通过 `id`），实现“选择内置 Key 即维护该分类”。

## 修改内容（增量）
- 更新 `apps/passport-web/app/[locale]/admin/certificates/categories/page.tsx`
  - 新增内置分类预设清单。
  - 页面加载时自动 `upsert` 内置分类到数据库（仅补齐，不覆盖已维护数据）。
- 更新 `apps/passport-web/components/certificate-admin-categories-client.tsx`
  - 将当前分类列表透传给 `CertificateCategoryForm`，用于 Key 选择后的分类匹配。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - `CertificateCategoryForm` 新增 `categories` 参数。
  - 新增 `activeCategory` 状态作为当前维护对象。
  - 选择内置 Key 时自动匹配已有分类并进入编辑态，表单字段回填该分类信息。
  - 提交 payload 的 `id` 改为 `activeCategory?.id`，保存即更新目标内置分类。

## 需求解读（增量：分类能力开关可维护）
- 列表中“自动签发 / 用户申请 / PDF / 公开验证”四项目前只是展示，不在维护表单里，无法保存。
- 需要把这四项纳入“分类维护信息”，并与列表展示保持一致的真实数据来源。

## 修改方法（增量）
- 在 `CertificateCategory` 数据模型新增 4 个布尔字段，并提供数据库迁移。
- 在分类 payload 校验与写库构建中接入 4 个字段。
- 在分类维护表单新增 4 个可编辑复选项并提交保存。
- 在分类列表中移除基于索引的伪状态，改为读取分类真实字段。

## 修改内容（增量）
- 更新 `prisma/schema.prisma`
  - `CertificateCategory` 新增：`autoIssueEnabled`、`userRequestEnabled`、`pdfEnabled`、`publicVerifyEnabled`。
- 新增 `prisma/migrations/20260524093000_certificate_category_feature_flags/migration.sql`
  - 为 `certificate_categories` 表新增上述 4 个字段及默认值。
- 更新 `apps/passport-web/lib/server/admin-certificates.ts`
  - `certificateCategoryPayloadSchema` 增加 4 个字段校验与默认值。
  - `buildCertificateCategoryWriteData` 增加 4 个字段写入。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 分类表单新增 4 个开关项并写入 payload。
  - 编辑态按分类当前值回填。
- 更新 `apps/passport-web/app/[locale]/admin/certificates/categories/page.tsx`
  - 页面数据映射包含 4 个字段并下发到客户端。
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 列表四列 checkbox 改为展示真实字段值，不再使用临时索引逻辑。

## 需求解读（增量：复选框保存报错）
- 调整四个分类能力复选框后保存失败。
- 根因是数据库未完成新字段迁移，导致写入时报错。

## 修改方法（增量）
- 在当前环境直接执行新增字段的 SQL 迁移文件，补齐 `certificate_categories` 表结构。
- 同时在 API 层增加“数据库结构未更新”错误分支，并在前端做本地化提示，避免再次出现泛化错误。

## 修改内容（增量）
- 数据库执行：`prisma/migrations/20260524093000_certificate_category_feature_flags/migration.sql`（已执行）。
- 更新 `apps/passport-web/app/api/admin/certificates/categories/route.ts`
  - 新增 Prisma `P2022` 错误识别，返回 `Database schema is outdated. Please run category migration.`。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 新增对应中文提示：`数据库结构未更新，请执行分类迁移后再保存。`

## 需求解读（增量：模板保存提示网络错误）
- 在 `admin/certificates/templates` 保存模板时，页面提示“网络错误”。
- 该问题本质上是后端异常未统一输出 JSON，前端又直接 `response.json()` 导致解析异常并误判为网络问题。

## 修改方法（增量）
- 模板 API 路由增加统一 `try/catch`，对已知 Prisma 错误返回结构化 JSON。
- 模板表单提交改为按 `content-type` 解析响应，避免非 JSON 响应触发异常。
- 新增模板保存错误文案本地化映射，中文环境显示可读错误。

## 修改内容（增量）
- 更新 `apps/passport-web/app/api/admin/certificates/templates/route.ts`
  - 新增异常兜底与 Prisma 错误分支（`P2025`、`P2003`）。
  - 未知异常统一返回 `Failed to save template.`。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 模板保存请求响应改为“按响应类型解析”。
  - 新增 `localizeTemplateSaveError(...)` 并在失败分支应用。

## 需求解读（增量：模板列表搜索与排序）
- `admin/certificates/templates` 需要与分类页一致，增加“搜索 + 列表视图排序选择器”。
- 模板列表最多展示 6 个条目。

## 修改方法（增量）
- 在模板管理组件新增 `searchKeyword`、`sortMode` 状态。
- 先按模板名/分类名过滤，再按排序模式排序并截断为 Top 6。
- 排序模式支持“最新（按更新时间）”和“签发最多（按已签发数）”。

## 修改内容（增量）
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateAdminTemplate` 新增 `updatedAt` 字段。
  - `CertificateAdminTemplates` 增加搜索输入与排序选择器。
  - 列表渲染由固定 `slice(0, 6)` 改为“过滤 + 排序 + Top 6”。
  - 无匹配结果时新增空状态提示。
- 更新 `apps/passport-web/app/[locale]/admin/certificates/templates/page.tsx`
  - 模板数据映射新增 `updatedAt`，用于“最新”排序。

## 需求解读（增量：模板卡片增加删除按钮）
- 在模板卡片“功能按钮”区域增加“删除”按钮，并可直接执行删除。
- 删除操作需要可控：用户需先确认，删除中应有禁用态反馈。
- 对于已有签发记录的模板，必须阻止删除并给出明确错误提示，避免数据破坏。

## 修改方法（增量）
- 前端模板卡片新增删除按钮，接入 `DELETE /api/admin/certificates/templates`，并在列表上做乐观移除 + 路由刷新。
- 前端新增删除失败本地化映射，覆盖权限不足、模板不存在、已有签发记录等典型错误。
- 后端模板路由新增 `DELETE` 处理：先校验模板是否存在、是否已产生签发记录，再在事务中删除 definition 与 template，并记录审计日志。

## 修改内容（增量）
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateAdminTemplates` 新增删除状态管理（`deletingTemplateId`、`removedTemplateIds`、`listError`）。
  - 模板卡片动作区新增“删除”按钮，带确认框与删除中禁用态。
  - 新增 `localizeTemplateDeleteError(...)`，删除失败时输出中文可读错误。
  - 删除成功后从当前列表移除目标卡片，并触发 `router.refresh()` 同步服务端数据。
- 更新 `apps/passport-web/app/api/admin/certificates/templates/route.ts`
  - 新增 `DELETE` handler。
  - 删除前检查模板关联定义的签发数；若存在签发记录返回 `409` 与明确错误。
  - 在事务中执行：先删 `certificateDefinition`，再删 `certificateTemplate`。
  - 新增 `certificate.template.delete` 审计日志写入。

## 需求解读（增量：复制可用、同页编辑、版式定义、编辑区预览）
- 模板卡片中的“复制”按钮需要从占位变为真实可用，点击后应创建一份可继续编辑的副本。
- 模板卡片“编辑”不应再跳转新页面，而应直接在下方模板编辑器回填并维护。
- 模板版式需要明确可配置入口，支持预设方向（横向/纵向/数字卡）并可定义尺寸。
- 在编辑区域增加模板预览能力，便于边改边看。

## 修改方法（增量）
- 将模板管理页改为“列表选中模板 -> 下方编辑器回填”的工作流，表单接收当前选中模板数据。
- 在模板卡片实现真实复制：基于当前模板构造创建 payload，调用现有模板保存接口创建副本。
- 扩展模板配置 schema 与 render/config 构建逻辑，新增可选 `pageWidthMm/pageHeightMm` 字段。
- 在模板表单增加“版式预设 + 宽高（mm）”输入，并新增编辑区内联预览面板。

## 修改内容（增量）
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - `CertificateAdminTemplates` 改为接收 `form(selectedTemplate, clearSelection)` 回调。
  - 卡片“编辑”按钮改为同页选中并回填编辑器，不再跳转详情页。
  - 卡片“复制”按钮实现真实复制（调用 `POST /api/admin/certificates/templates` 创建副本）。
  - 卡片“预览”按钮改为定位到下方编辑区，配合编辑区预览模块使用。
  - 扩展模板类型字段（`categoryId`、`renderConfig`、`definition`）供编辑/复制复用。
- 更新 `apps/passport-web/app/[locale]/admin/certificates/templates/page.tsx`
  - 查询模板时补充定义详情与签发计数，并映射为列表与编辑器所需完整结构。
  - 列表页表单改为动态回填 `CertificateTemplateForm`（支持取消编辑回到新增模式）。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - `CertificateTemplateForm` 增加编辑态取消按钮。
  - 新增版式字段：`pageWidthMm`、`pageHeightMm`。
  - 新增编辑区内联模板预览模块（跟随名称、机构、版式比例、配色与背景图变化）。
- 更新 `apps/passport-web/lib/server/admin-certificates.ts`
  - 模板 payload schema 新增 `pageWidthMm/pageHeightMm` 校验。
  - `buildCertificateTemplateRenderConfig` 与 `buildCertificateTemplateConfig` 写入版式宽高。
- 更新 `apps/passport-web/lib/server/certificate-module.ts`
  - `parseCertificateRenderConfig` 增加版式宽高解析，供模板回填与预览使用。
- 更新 `apps/passport-web/app/globals.css`
  - 新增模板编辑区内联预览与版式提示样式。

## 需求解读（增量：下一步增强）
- 编辑区预览需要更接近最终证书渲染，而不是仅静态占位样式。
- 复制成功后应直接进入可编辑状态，减少“复制后还要手动找”的操作成本。
- 模板卡片层面需要直接可见版式信息（预设 + 尺寸），便于快速识别。

## 修改方法（增量）
- 新增模板预览 API（管理员权限），根据当前编辑器输入实时生成证书 HTML。
- 表单预览区域改为 `iframe` 加载服务端生成的 `srcDoc`，并支持自动刷新与手动刷新。
- 复制成功后将返回的新模板设置为当前编辑对象并自动定位到编辑区。
- 模板卡片中增加版式标签，展示“横/竖/数字卡 + 宽高(mm)”。

## 修改内容（增量）
- 新增 `apps/passport-web/app/api/admin/certificates/templates/preview/route.ts`
  - 新增 `POST` 预览接口，校验管理员权限。
  - 接收模板配置并调用证书渲染器生成 HTML，返回给编辑器预览。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 模板预览改为 iframe（`srcDoc`）展示真实渲染输出。
  - 新增自动预览刷新与“刷新预览”按钮。
  - 预览请求包含分类、版式、颜色、背景图、元素 JSON 等当前编辑值。
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 复制成功后自动选中新副本并滚动定位到编辑器。
  - 模板卡片新增版式标签展示函数与显示位。
- 更新 `apps/passport-web/app/globals.css`
  - 新增 iframe 预览与预览头部操作按钮样式。

## 需求解读（增量：列表预览全屏弹层）
- 列表卡片“预览”按钮应直接打开只读全屏预览弹层。
- 预览时不跳转、不离开当前页面，且可快速关闭返回列表上下文。

## 修改方法（增量）
- 在模板列表组件增加全屏预览状态机（当前模板、HTML、加载态、错误态）。
- 复用现有预览 API 拉取 HTML，并在弹层 iframe 中只读展示。
- 增加关闭交互（点击遮罩、关闭按钮、ESC）。

## 修改内容（增量）
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 卡片“预览”按钮行为改为打开全屏弹层，不再跳转或滚动到编辑区。
  - 新增 `openTemplatePreview(...)` / `closeTemplatePreview(...)` 逻辑与 ESC 监听。
  - 新增全屏只读预览弹层结构（标题、版式信息、关闭按钮、iframe、错误提示）。
- 更新 `apps/passport-web/app/globals.css`
  - 新增 `cpca-preview-modal*` 全屏弹层样式，支持桌面与移动端。

## 需求解读（增量：修复 Client Component 函数透传错误）
- 模板管理页在运行时出现 Next.js 报错：服务端页面把 `form` 函数直接传给客户端组件，违反 Server/Client 边界。
- 需要消除该报错，同时保持“同页编辑 + 下方编辑器回填”的既有功能不回退。

## 修改方法（增量）
- 参考分类模块已有做法，新增模板管理专用客户端包装组件。
- 服务端页面只负责取数并下发纯数据；函数型 `form` 回调改在客户端包装组件内部声明并传递。

## 修改内容（增量）
- 新增 `apps/passport-web/components/certificate-admin-templates-client.tsx`
  - 在客户端内组合 `CertificateAdminTemplates` 与 `CertificateTemplateForm`。
  - 在客户端边界内传递 `form(selectedTemplate, clearSelection)` 回调。
- 更新 `apps/passport-web/app/[locale]/admin/certificates/templates/page.tsx`
  - 改为渲染 `CertificateAdminTemplatesClient`。
  - 移除服务端页面对 `CertificateTemplateForm` 与函数回调的直接传递，仅传递模板与分类数据。

## 需求解读（增量：元素 JSON 详细指导 + 变量说明 + 开关位置调整）
- “元素配置 JSON”需要提供可直接操作的详细帮助，指导模板设计人员理解位置、字体、层级、类型等关键字段。
- 需要明确列出可用变量及其数据来源，避免配置未知变量导致渲染为空。
- “启用该模板和默认签发定义”开关应移动到保存按钮上方，提升提交前确认体验。

## 修改方法（增量）
- 在模板表单中新增两个帮助区块：
  - 元素 JSON 设计指南（字段含义 + 规则 + 示例）。
  - 变量参考说明（变量名 + 来源 + 使用说明）。
- 将启用开关节点从 JSON 输入下方移动到消息提示区与按钮区之间（按钮正上方）。
- 为帮助区增加专用样式，保证信息密度高但可读性稳定。

## 修改内容（增量）
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 新增“元素配置 JSON 指南”区块，包含：坐标百分比、字体/对齐、zIndex/visible、元素类型说明。
  - 新增完整 JSON 示例，指导常见 VARIABLE 与 NOTE 布局写法。
  - 新增“可用变量”区块，明确：`holderName`、`certificateName`、`categoryName`、`issueDate`、`certificateNumber`、`issuerName`、`verificationUrl`。
  - 将“启用该模板和默认签发定义”移动到保存按钮上方。
- 更新 `apps/passport-web/app/globals.css`
  - 新增 `template-json-help` 及其标题、列表、示例代码块样式。

## 需求解读（增量：变量一键复制 + 默认折叠 + JSON 保存回退修复）
- 继续增强变量说明交互：支持一键复制变量名，降低手工输入错误率。
- “元素配置 JSON 指南”与“可用变量”两个区块需改为可折叠，且默认折叠，避免编辑区过长。
- 修复“JSON 修改后保存会恢复旧内容”的问题，确保编辑态内容不会被旧数据覆盖。

## 修改方法（增量）
- 将两个帮助区块改为 `details/summary` 折叠结构，不添加 `open` 属性以实现默认收起。
- 在变量列表中增加“复制”按钮，调用剪贴板 API，短暂显示复制成功反馈。
- 修复 JSON 回退根因：
  - 客户端包装组件避免每次渲染都创建新的 `initialTemplate` 对象。
  - 表单初始化 `useEffect` 依赖从整对象改为 `initialTemplate?.id`，避免无关重渲染触发表单回填旧值。

## 修改内容（增量）
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 两个说明区改为可折叠，默认折叠。
  - 变量项新增一键复制按钮与复制态提示。
  - `initialTemplate.categoryId` 改为可选，适配直接透传模板对象。
  - 表单初始化依赖改为 `initialTemplate?.id`，修复保存后 JSON 回退问题。
- 更新 `apps/passport-web/components/certificate-admin-templates-client.tsx`
  - `initialTemplate` 改为直接透传 `selectedTemplate`，避免每次渲染构造新对象。
- 更新 `apps/passport-web/app/globals.css`
  - 新增折叠标题、展开/收起符号、变量行与复制按钮样式。

## 需求解读（增量：预览中的 Print/Save PDF 无响应）
- 证书模板预览里的 `Print / Save PDF` 按钮点击后无反应，需要恢复打印能力。
- 该按钮位于 iframe 的 `srcDoc` 页面内，需确保 iframe sandbox 权限允许触发打印对话框。

## 修改方法（增量）
- 保留现有 `window.print()` 逻辑不变。
- 调整两个预览 iframe 的 `sandbox` 权限，从仅 `allow-scripts` 扩展为 `allow-scripts allow-modals`，允许打开系统打印弹窗。

## 修改内容（增量）
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 内联预览 iframe 的 `sandbox` 改为 `allow-scripts allow-modals`。
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 全屏预览弹层 iframe 的 `sandbox` 改为 `allow-scripts allow-modals`。

## 需求解读（增量：模板预览导出 PDF 文件名优化）
- 模板预览中的 `Print / Save PDF` 导出文件名需要更清晰。
- 目标命名格式：`证书分类-模版名称（模版）`。

## 修改方法（增量）
- 在证书 HTML 渲染器中增加可选 `documentTitle` 参数，用于控制预览文档标题。
- 仅在“模板预览 API”中传入该标题，避免影响真实签发证书的既有命名逻辑。
- 对标题进行基础非法字符清理，确保跨系统保存时更稳定。

## 修改内容（增量）
- 更新 `apps/passport-web/lib/server/certificate-module.ts`
  - `renderCertificateHtml(...)` 新增 `documentTitle` 入参。
  - HTML `<title>` 优先使用 `documentTitle`，否则回退到证书名称。
- 更新 `apps/passport-web/app/api/admin/certificates/templates/preview/route.ts`
  - 新增预览文件名清理函数。
  - 生成并传入 `documentTitle = 证书分类-模版名称（模版）`。

## 需求解读（增量：浏览器仍使用平台标题作为 PDF 文件名）
- 虽然预览 HTML 已设置 `<title>`，但在 iframe 打印场景下，浏览器仍可能使用父页面标题（`Climate Passport Platform`）作为保存名。
- 需要在打印触发瞬间确保父页面标题与预览标题同步。

## 修改方法（增量）
- 在预览 HTML 的打印按钮逻辑中，打印前通过 `postMessage` 通知父页面本次打印标题。
- 在两个预览承载页面（内联预览与全屏弹层）监听该消息，临时切换 `document.title`，短延时恢复原标题。

## 修改内容（增量）
- 更新 `apps/passport-web/lib/server/certificate-module.ts`
  - 预览 HTML 注入 `printCertificate()`，先发 `certificate-preview-title` 消息再执行 `window.print()`。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 新增 `message` 监听：接收预览标题并临时覆盖页面标题后自动恢复。
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 全屏预览页同样新增标题同步监听与恢复机制。

## 需求解读（增量：文件名仍回退为平台标题）
- 在实际打印流程中，用户可能停留在打印弹窗较久，固定延时恢复标题会过早触发，导致保存时名称再次回退为平台标题。

## 修改方法（增量）
- 将“标题恢复时机”从固定超时改为打印生命周期事件：`afterprint`。
- 同时保留长超时兜底，防止极端情况下 `afterprint` 未触发导致标题长期停留。

## 修改内容（增量）
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - 标题恢复改为 `afterprint` 事件驱动。
  - 新增打印态标记，避免无效恢复。
- 更新 `apps/passport-web/components/certificate-admin-prototype.tsx`
  - 全屏预览页同样改为 `afterprint` 恢复标题，超时仅作兜底。

## 需求解读（增量：二维码与提示文字相对位置可配置）
- 需要在模板 `elements` JSON 中直接调整二维码与提示文字之间的相对布局，不依赖全局 CSS 固定值。

## 修改方法（增量）
- 为 `QR` 元素新增专用字段：
  - `qrLabelGap`: 二维码与文字间距。
  - `qrLabelOffsetY`: 文字纵向偏移。
  - `qrLabelFontSize`: 文字字号。
- 在后端校验、渲染配置解析、HTML 渲染三个环节同步支持，确保保存后可真实生效。
- 在 JSON 指南中补充字段说明与可直接复制的示例。

## 修改内容（增量）
- 更新 `apps/passport-web/lib/server/admin-certificates.ts`
  - `certificateElementSchema` 增加 `qrLabelGap`、`qrLabelOffsetY`、`qrLabelFontSize` 校验。
- 更新 `apps/passport-web/lib/server/certificate-module.ts`
  - `CertificateRenderElement` 增加上述 3 个字段。
  - `sanitizeRenderElement` 解析并约束上述字段范围。
  - `QR` 渲染逻辑改为使用可配置间距/偏移/字号。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - JSON 指南增加 QR 细调说明与示例段。

## 需求解读（增量：预览正常但保存时报 Invalid input）
- 用户已经在模板 JSON 中完成修改并能正常预览，说明前端 JSON 本身可被预览链路接受。
- 保存时报 `Invalid input`，属于保存接口与预览接口对同一份 `elements` JSON 的容错规则不一致，必须统一，避免“能预览不能保存”的行为分叉。

## 修改方法（增量）
- 将模板保存时的 `elements` 校验从“逐字段严格拒绝”调整为“先接收数组，再按预览同类规则做清洗与标准化”。
- 保留保存后的后端规范化，确保数据库中仍写入受控结构。
- 当 payload 仍然非法时，接口返回包含字段路径的错误信息，而不是笼统的 `Invalid input`。
- 增加针对 `QR` 新字段和宽松输入的回归测试，覆盖“预览可接受、保存也应可接受”的场景。

## 修改内容（增量）
- 更新 `apps/passport-web/lib/server/admin-certificates.ts`
  - `certificateTemplatePayloadSchema.elements` 改为接受原始数组输入。
  - 新增模板元素清洗函数，在保存前统一标准化 `QR`、文本、图片等元素字段。
  - `buildCertificateTemplateRenderConfig` 改为写入清洗后的 `elements`。
- 更新 `apps/passport-web/app/api/admin/certificates/templates/route.ts`
  - 模板保存失败时返回带字段路径的错误信息，便于快速定位非法字段。
- 更新 `tests/admin-certificates.test.mjs`
  - 新增保存链路测试，验证 `qrLabelGap`、`qrLabelOffsetY`、`qrLabelFontSize` 以及 `null/extraField` 这类预览可容忍输入在保存时会被正确清洗，而不是直接报错。

## 需求解读（增量：Print / Save PDF 未带出背景图）
- 模板预览页已经能显示背景图，说明背景图数据本身是正常的。
- 问题出在打印/PDF 导出阶段：如果背景图只通过 CSS `background-image` 挂在容器上，浏览器打印时可能默认忽略背景图层，导致导出的 PDF 丢背景。

## 修改方法（增量）
- 将证书背景图从 CSS 背景改为真实的图片层元素，放在证书内容底层参与页面渲染与打印。
- 保留页面背景色，并补充 `print-color-adjust`，尽量减少浏览器打印时对视觉层的裁剪。
- 增加回归测试，确保证书 HTML 在存在背景图时一定输出对应的图片层标签。

## 修改内容（增量）
- 更新 `apps/passport-web/lib/server/certificate-module.ts`
  - `renderCertificateHtml` 不再通过容器 `background-image` 注入证书背景。
  - 新增 `cert-background-image` 背景图片层，使用绝对定位铺满整个证书区域。
  - 为打印场景增加 `-webkit-print-color-adjust: exact` 与 `print-color-adjust: exact`。
- 更新 `tests/certificate-artifact.test.mjs`
  - 新增测试，验证带背景图配置时生成的证书 HTML 会输出可打印的背景图片层。

## 需求解读（增量：按新产品规范落地证书变量体系）
- 需要把“产品规范中保留字段 + 草案中的分层与双语字段规则”落实到可运行代码，而不仅停留在文档。
- 重点是四条链路同时一致：模板保存校验、渲染器变量识别、预览默认值、前端可用变量帮助说明。
- 变量扩展后必须保证旧模板不回归，并保证新增变量能在预览与渲染中直接可见。

## 修改方法（增量）
- 扩展模板变量白名单，统一采用分层规范中的字段集合（包含中英独立字段、固定字段、场景语义字段）。
- 将渲染器变量模型升级为统一枚举，并在渲染入口支持 `variableValues` 注入，保证新增变量可渲染。
- 在模板预览 API 注入扩展变量示例值，让新变量在预览态可直接观察。
- 在模板编辑页“可用变量”说明里展示完整变量清单与解释，降低配置成本。
- 增加测试覆盖，验证新增变量可通过保存链路并正确渲染。

## 修改内容（增量）
- 更新 `apps/passport-web/lib/server/admin-certificates.ts`
  - 扩展模板元素 `variable` 白名单，支持中英独立字段与产品规范固定字段（如 `completionDate`、`learningHours`、`capabilityTags`、`signer`、`institutionName` 等）。
  - `buildCertificateTemplateConfig` 的 `fields` 同步更新为合并后的变量集合。
- 更新 `apps/passport-web/lib/server/certificate-module.ts`
  - 扩展渲染器变量白名单和 `CertificateRenderElement.variable` 类型。
  - `renderCertificateHtml` 新增 `variableValues` 输入并与基础变量合并，支持数组值（如能力标签）自动拼接。
  - 新增双语/场景语义变量默认值，保持旧模板兼容。
- 更新 `apps/passport-web/app/api/admin/certificates/templates/preview/route.ts`
  - 预览 payload 支持 `variableValues`、`holderNameEn`、`completionDate` 等扩展输入。
  - 预览输出增加扩展变量样例值，便于模板配置即时验证。
- 更新 `apps/passport-web/components/admin-certificate-config-forms.tsx`
  - “可用变量”帮助区替换为扩展后的完整变量列表与中英说明，并保留一键复制。
- 更新 `tests/admin-certificates.test.mjs`
  - 增加模板配置字段集合断言，验证保留字段已纳入。
  - 增加扩展变量（如 `programNameEn`、`completionDate`）在保存清洗链路中的通过性断言。
- 更新 `tests/certificate-artifact.test.mjs`
  - 增加扩展变量解析与渲染断言，验证 `variableValues` 生效与标签数组拼接逻辑。
