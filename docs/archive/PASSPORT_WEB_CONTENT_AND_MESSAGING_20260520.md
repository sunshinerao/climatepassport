# Climate Passport Web 内容与消息页面扩展记录

## 需求解读

- Climate Passport 需要拥有独立于 SHCW 的平台信息页，包括 About、Contact、Terms、Privacy、FAQ，且内容边界应体现 Passport 是系统主平台而不是频道壳站。
- `passport-web` 需要直接接入已迁移的真实嘉宾和议程数据，完成一轮可见页面级验证。
- 平台还需要补齐 `messages / notifications` 页面，用于承载事务性、流程型的平台沟通，而不是复用 SHCW 的传播内容逻辑。

## 修改方法

- 扩展 `site-content.ts`，为 Passport 自有静态页、消息页、通知页增加中英文独立内容。
- 扩展 `platform-data.ts`，把真实 `speaker / agenda / registration / certificateIssue / invitationRequest / specialPass` 数据接入页面 loader。
- 扩展 `platform-screens.tsx`，新增 `SpeakersScreen`、`MessagesScreen`、`NotificationsScreen`、`InfoScreen`，并把 agenda 内容接入现有 `EventsScreen`。
- 新增 Passport Web 路由页面，并在 footer 暴露 Passport 自有信息页入口。
- 通过 `npm run build` 与本地 dev server + HTTP 路由冒烟，完成页面级验证。

## 修改内容

- 更新 `apps/passport-web/lib/site-content.ts`
- 更新 `apps/passport-web/lib/server/platform-data.ts`
- 更新 `apps/passport-web/components/platform-screens.tsx`
- 更新 `apps/passport-web/components/site-shell.tsx`
- 更新 `apps/passport-web/app/globals.css`
- 新增 `apps/passport-web/app/[locale]/speakers/page.tsx`
- 新增 `apps/passport-web/app/speakers/page.tsx`
- 新增 `apps/passport-web/app/[locale]/dashboard/messages/page.tsx`
- 新增 `apps/passport-web/app/[locale]/dashboard/notifications/page.tsx`
- 新增 `apps/passport-web/app/[locale]/about/page.tsx`
- 新增 `apps/passport-web/app/[locale]/contact/page.tsx`
- 新增 `apps/passport-web/app/[locale]/terms/page.tsx`
- 新增 `apps/passport-web/app/[locale]/privacy/page.tsx`
- 新增 `apps/passport-web/app/[locale]/faq/page.tsx`
- 新增 `apps/passport-web/app/dashboard/messages/page.tsx`
- 新增 `apps/passport-web/app/dashboard/notifications/page.tsx`
- 新增 `apps/passport-web/app/about/page.tsx`
- 新增 `apps/passport-web/app/contact/page.tsx`
- 新增 `apps/passport-web/app/terms/page.tsx`
- 新增 `apps/passport-web/app/privacy/page.tsx`
- 新增 `apps/passport-web/app/faq/page.tsx`
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
- 新增 `docs/PASSPORT_WEB_CONTENT_AND_MESSAGING_20260520.md`