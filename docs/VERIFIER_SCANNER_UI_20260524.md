# Verifier Scanner UI — 2026-05-24

## 需求解读 (Requirements interpretation)

- 跟踪器 `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md` 中的 `CP-TODO-069` 标记为当前 #1 优先开发项，要求补齐 Verifier 端的扫码界面 / 嵌入式核验流程。
- 后端 `POST /api/verifier/scan` 已具备身份扫码 + 活动签到的完整能力，但缺少前端入口；具有 `ADMIN / EVENT_MANAGER / VERIFIER` 角色的用户无法在浏览器中直接使用摄像头扫码。
- 必须满足：
  - 角色访问网关：仅 ADMIN / EVENT_MANAGER / VERIFIER 可进入；
  - 支持摄像头扫码（QR）+ 手动输入兜底，覆盖 Safari / Firefox 不支持 `BarcodeDetector` 的场景；
  - 可选择活动上下文（Identity / Event Check-In），活动范围按角色过滤；
  - 历史记录可见，便于核验员复核；
  - 中英文双语；
  - 进入入口：管理员侧栏 + 用户工作台快捷操作。

## 修改方法 (Modification method)

1. 新建服务端 helper `lib/server/verifier.ts`：根据登录用户角色返回可签到活动集合（ADMIN 全量、EVENT_MANAGER 自管、VERIFIER 通过 `EventVerifier` 分配、其它角色空）。
2. 新建客户端组件 `components/verifier-scanner.tsx`：
   - 使用 `getUserMedia({ facingMode: "environment" })` + `BarcodeDetector` 在 `requestAnimationFrame` 循环中扫码；
   - 4 秒去重，避免同一二维码重复请求；
   - 手动输入兜底；
   - 调用 `/api/verifier/scan` 并按 result 码（valid / checked_in / already_checked_in / expired / invalid / wrong_event / permission_denied / not_registered / not_approved / unsupported）映射中英文提示与色系；
   - 维护最近 20 条扫码历史；
   - 不支持 `BarcodeDetector` 的浏览器禁用摄像头按钮并提示。
3. 新建路由 `app/[locale]/verifier/page.tsx`：`force-dynamic` + `noStore()` + `requireRoleAccess(["ADMIN","EVENT_MANAGER","VERIFIER"])`，把可核验活动序列化后传给客户端组件。
4. 在 `components/admin-shell.tsx` 的 `buildAdminMenu` 中新增「扫码与签到 / Verifier console」入口（ADMIN / EVENT_MANAGER 可见）。
5. 在 `app/[locale]/dashboard/page.tsx` 的「快捷操作」卡片中为 VERIFIER（以及 ADMIN / EVENT_MANAGER）补一条 Verifier 控制台快捷链接。
6. 在 `app/globals.css` 末尾追加 `proto-verifier-*` 样式（响应式两列布局、视频区 4:3、按钮 primary/ghost、历史卡片按 ok/warn/error 着色边条）。
7. 同步更新 `docs/CURRENT_IMPLEMENTATION_STATUS.md` 与 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`，将扫码 UI 从 Pending / In-Progress 调整为 Implemented / done，并刷新优先级列表。

## 修改内容 (Modification content)

### 新增文件

- `apps/passport-web/lib/server/verifier.ts`
  - `VerifiableEvent` 类型 + `loadVerifiableEvents(actor, limit=60)`：基于角色返回可签到活动列表。
- `apps/passport-web/components/verifier-scanner.tsx`
  - `"use client"` 组件 `VerifierScanner`；
  - 状态：`eventId / manualToken / history / submitting / scannerStatus / scannerError`；
  - 摄像头生命周期：`startCamera` / `stopCamera`（rAF + tracks 清理）；
  - 提交逻辑：`submitToken(token, source)`，POST `/api/verifier/scan`；
  - 结果映射：`describeResult(locale, payload)` 输出双语 title / detail / tone；
  - 全局 `Window.BarcodeDetector` 类型声明。
- `apps/passport-web/app/[locale]/verifier/page.tsx`
  - 服务端路由，鉴权后渲染 `<VerifierScanner ... />`。
- `docs/VERIFIER_SCANNER_UI_20260524.md`（本文档）。

### 修改文件

- `apps/passport-web/components/admin-shell.tsx`
  - 在系统/运营条目和「返回用户工作台」之间插入 `${prefix}/verifier` 项，限定 ADMIN / EVENT_MANAGER 可见。
- `apps/passport-web/app/[locale]/dashboard/page.tsx`
  - 「快捷操作」面板：为 VERIFIER 或 isAdminUser 增加「扫码与签到 / Verifier console」链接。
- `apps/passport-web/app/globals.css`
  - 追加 `~135` 行 `proto-verifier-*` 样式（shell、grid、card、video、actions、btn primary/ghost、history、status badge、muted/warn）。
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
  - 在「QR And Verifier」实现清单新增 Scanner UI 行；
  - 「In Progress / Partial」描述更新：去除 scanner UI 字样；
  - 「Current Development Priorities」移除已完成的 #1 扫码 UI 项，其余顺次上移。
- `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
  - `CP-TODO-069` 改为 `done`，并附实现位置说明。

### 已验证项

- 五个改动文件均通过 TypeScript 编译诊断（`get_errors` 全部无错）。

### 回归注意点

- `/[locale]/admin` 侧栏导航新增一项 — 检查管理员页布局是否仍正常；
- `/[locale]/dashboard` 快捷操作行增加一项 — 检查布局换行；
- `/[locale]/verifier` 新路由 — 验证未授权用户被重定向到登录；
- `/api/verifier/scan` 行为未改动，应保持既有返回结构；
- `globals.css` 仅追加新类前缀，未修改既有规则。
