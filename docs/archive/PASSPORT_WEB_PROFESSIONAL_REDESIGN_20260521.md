# Climate Passport Web — 专业级重设计

**日期**: 2026-05-21  
**范围**: `apps/passport-web`  
**状态**: ✅ 已完成，构建通过

---

## 需求解读

原有代码使用大量面向开发者的内部术语（"Core Platform Layer"、"Certificate Hub"、"Event Hub"、"Verifier Sprint"、"运营指挥中心"等），页面布局幼稚，组件系统残缺，无法作为面向真实用户的机构级平台使用。

要求参照以下两份文档进行全面重设计：
- `docs/climate-passport-design-foundation.md` — 视觉设计规范与 token 系统
- `docs/climate-passport-development-specification.md` — 产品规格，定义平台核心概念

目标：将 Climate Passport 从开发者演示界面升级为专业、可用的机构级平台。

---

## 修改方法

1. **不改动类型结构**：`SiteDictionary` 类型不变，所有修改均为值层面更新，确保 TypeScript 构建通过。
2. **CSS 优先**：所有新样式添加到 `globals.css`，不引入 Tailwind 或行内样式。
3. **内容与结构分离**：`site-content.ts` 仅做文案更新，`platform-screens.tsx` 仅做结构/JSX 更新。
4. **渐进验证**：每类文件修改后运行生产构建确认无报错。

---

## 修改内容

### 1. `app/globals.css` — 组件系统扩充

新增以下 CSS 组件类，支撑重设计后的页面结构：

| 类名 | 用途 |
|------|------|
| `.two-col` | 修复缺失的桌面端 `grid-template-columns: 1fr 1fr` 定义 |
| `.tag-row` / `.tag` | 技能/话题标签行 |
| `.dot` / `.dot-green` / `.dot-amber` / `.dot-blue` | 状态指示点 |
| `.value-steps` / `.value-step` / `.step-num` / `.step-text` | 价值主张三步骤说明 |
| `.cert-list` / `.cert-item` / `.cert-mark` / `.cert-info` / `.cert-issuer` / `.cert-code` | 证书卡片列表 |
| `.person-grid` / `.person-card` / `.person-top` / `.person-avatar` / `.person-info` / `.person-title` / `.person-org` | 人物网格卡片 |
| `.activity-list` / `.activity-entry` / `.activity-pin` / `.activity-body` / `.activity-time` | 活动日程动态列表 |
| `.badge-grid` / `.badge-tile` / `.badge-tile.earned` / `.badge-tile.locked` / `.badge-icon` / `.badge-name` | 成就徽章网格 |
| `.auth-grid` / `.auth-value` / `.auth-form-side` | 登录/注册双栏布局（左深色价值区 + 右表单区） |
| `.mono` | 等宽字体（用于 Passport ID、证书编号） |

响应式规则同步更新：`.auth-grid`（980px 折叠为单栏）、`.badge-grid` / `.person-grid`（980px 两列，badge 在 720px 保持两列）。

### 2. `components/platform-screens.tsx` — 六个核心页面重设计

| 页面 | 主要改动 |
|------|----------|
| `HomeScreen` | Hero 侧边栏改为三步价值主张（`.value-steps`）；模块卡片移除内部状态标签；CTA 链接改为 `/auth/register` 和 `/certificates` |
| `ClimatePassportScreen` | 成就区改用 `.badge-grid` / `.badge-tile`（✦/○ 图标），Passport ID 加 `.mono` 类 |
| `CertificatesScreen` | 移除内部"发放队列"和"核验检查"双栏表格，改为两个干净的 `.cert-list` 证书卡片区 |
| `EventsScreen` | 移除"Passport Verifier Sprint"和"运营指挥中心"等内部活动；用 `.activity-list` 展示公开日程 |
| `SpeakersScreen` | 完全重设计：移除"数据治理"侧边面板；改用 `.person-grid` / `.person-card` + `.tag-row` / `.tag` |
| `LoginScreen` / `RegisterScreen` | 布局从 `.split` + `.hero-card` + `.panel` 改为 `.auth-grid`，左侧深色价值区，右侧表单 |

### 3. `lib/site-content.ts` — 英中双语内容全面更新

**中英文均完成**的内容更新：

- **账号快照**：Passport ID 改为 `CP-2026-012480`，角色改为 `Contributor`
- **home**：kicker/title 改为用户向文案；模块改为"身份与护照"/"证书与凭证"/"活动与参与"；指标标签改为用户语言
- **passport**：title 改为"我的 Climate Passport"/"My Climate Passport"；authority 改为"由 Climate Passport 签发"；成就从 4 项扩展为 8 项
- **certificates**：label 改为"证书"/"Certificates"；移除内部术语；证书编号使用规范格式 `CP-CERT-2026-XXXXX`
- **events**：移除"Passport Verifier Sprint"和"运营指挥中心"；新增"气候金融密集课"；日程时间改为可读格式（`09:00 — Jun 8`）
- **speakers**：label 改为"人物"/"People"；从 2 人扩展至 6 人，包含职务、机构、地区、话题标签
- **auth**：login kicker 改为"欢迎回来"/"Welcome back"；register kicker 改为"加入 Climate Passport"/"Join Climate Passport"
- **shell.footer**：移除"主题化前端壳"、"Certificate Hub"等内部术语；改为用户向文案

### 4. `components/site-shell.tsx` — 品牌副标题修正

- `"Core Platform Layer"` → `"Climate Identity Platform"`

---

## 验证结果

```
npm run build --workspace passport-web

✓ 构建完成，0 TypeScript 错误
✓ 所有路由正常生成（静态/动态）
✓ /auth/login, /auth/register, /certificates, /events, /speakers, /dashboard/climate-passport 全部通过
```
