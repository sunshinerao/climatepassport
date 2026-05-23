# UI Prototype Alignment Audit

Date: 2026-05-23

## 1. Prototype Reference Rule

`docs/ui-prototypes/` is the reference location for future page prototypes created outside the codebase.

Implementation rule:

- Do not use prototype hero sections as binding requirements.
- Do not use prototype footers as binding requirements.
- Use the rest of each prototype page as the preferred layout and UI/UX reference.
- If page content is informationally consistent with product requirements, prefer expanding it according to the prototype.
- Reproduce prototype UI/UX as closely as practical.
- Keep data logic independent and aligned with Climate Passport Core decisions.

## 2. Prototype Files Reviewed

- `docs/ui-prototypes/index.html`
- `docs/ui-prototypes/auth.html`
- `docs/ui-prototypes/dashboard.html`
- `docs/ui-prototypes/events.html`
- `docs/ui-prototypes/admin.html`
- `docs/ui-prototypes/certificates-admin.html`
- `docs/ui-prototypes/certificates-profile.html`
- `docs/ui-prototypes/certificates-user.html`
- `docs/ui-prototypes/certificates-verify.html`

## 3. Current Implementation Surfaces Reviewed

- `apps/passport-web/components/platform-screens.tsx`
- `apps/passport-web/components/events-filterable-grid.tsx`
- `apps/passport-web/components/auth-form.tsx`
- `apps/passport-web/components/admin-events-manager.tsx`
- `apps/passport-web/components/admin-certificate-manager.tsx`
- `apps/passport-web/components/learning-experiences-dashboard.tsx`
- `apps/passport-web/components/admin-learning-programs-manager.tsx`
- `apps/passport-web/app/[locale]/dashboard/page.tsx`
- `apps/passport-web/app/[locale]/admin/page.tsx`
- `apps/passport-web/app/[locale]/admin/certificates/page.tsx`

## 4. Alignment Summary

| Prototype | Implemented surface | Alignment | Notes |
|---|---|---:|---|
| `index.html` | `HomeScreen` | Partial | Current page already uses prototype-like stats, feature cards, and how-it-works sections. It does not yet include the prototype's upcoming events body section. Hero/footer are intentionally excluded from binding comparison. |
| `auth.html` | `LoginScreen`, `RegisterScreen`, `AuthForm` | Good | Current two-column auth shell, tabs, value proposition, and form panel are close. Register form includes additional Core profile fields; that is acceptable because data logic is independent. |
| `dashboard.html` | `[locale]/dashboard/page.tsx`, `ClimatePassportScreen` | Good / Partial | Dashboard overview closely follows the prototype with passport card, KPI area, timeline, certificates, badges, and quick actions. The standalone Climate Passport subpage is simpler than the prototype dashboard card and can reuse more of the dashboard card treatment. |
| `events.html` | `EventsScreen`, `EventsFilterableGrid` | Good / Partial | Search, filters, event cards, and past events are present. Current implementation lacks the prototype's distinct featured event section and uses a separate agenda section not present in the prototype. Data logic can stay as-is, but layout should add featured-card treatment when an event is prioritized. |
| `admin.html` | `[locale]/admin/page.tsx`, `AdminEventsManager`, LE admin components | Partial | Admin shell and overview use prototype-like sidebar, metrics, panels, and module cards. Events and LE admin detail pages currently use two-column list/form panels instead of prototype table/filter/dashboard panels. Not a data conflict, but UI should converge toward prototype density and table-first admin UX. |
| `certificates-admin.html` | `AdminCertManager`, admin certificate page | Low / Partial | Current Certificate Admin exists but is much smaller: tabs for categories/templates/issue and recent issues. Prototype includes dashboard, categories, templates, issuing rules, batch issue, applications, records, verification logs, and admin logs. This is the largest visual/IA gap. |
| `certificates-user.html` | `CertificatesScreen`, dashboard certificates block | Low | Current user certificate page is a requirements/status summary, not the prototype's portfolio with search/filter, certificate cards, detail preview, download/share, verification URL, and status states. |
| `certificates-profile.html` | No direct full implementation | Low | Current Passport/dashboard pages expose profile/passport pieces, but not a public profile with featured credentials, competencies, timeline, full credential list, and program participation. |
| `certificates-verify.html` | No direct full implementation | Low | Current docs define public verification behavior, but the verify page is not yet implemented as a full UI surface. |

## 5. Conflicts With Current Product/Data Decisions

These are content/data conflicts inside prototypes. The layout can still be reused, but these details must be changed during implementation.

| Prototype | Conflict | Required implementation adjustment |
|---|---|---|
| `index.html` | Uses "Blockchain-backed credentials". | Replace with "server-verified" / "cryptographically verifiable" / "independently verifiable" wording unless blockchain anchoring becomes a confirmed product decision. |
| `certificates-user.html` | Uses "Blockchain Verified", "Blockchain Hash", distributed ledger copy, and on-chain style hash fields. | Replace with Climate Passport Core verification, opaque verification code, signature/integrity status if implemented, and server-side revocation status. |
| `certificates-verify.html` | Shows "Blockchain Hash" and blockchain-specific verification details. | Replace with allowed public verification facts and optional "Digital signature" or "Server verified" fields. |
| `certificates-admin.html` | Certificate number format field uses `CP-CERT-{YEAR}-{SEQ6}` and sample sequential certificate numbers. | Do not use this as a required identifier algorithm. Certificate number may be public, but verification must use an opaque verification code and should not be treated as the Core QR token. |
| `certificates-verify.html` | Revoked state shows "Reason: Administrative decision". | Public verification should not expose admin notes or internal decision details. Show only revoked status and revocation date if product approves. |
| `certificates-verify.html` | Shows competency areas. | This is not forbidden, but must be reviewed against minimum necessary disclosure. If shown, it should be part of credential metadata, not private profile data. |
| `certificates-user.html` | Share via Email appears in user-owned page. | Acceptable for authenticated user view, but public verification pages must not expose email. |
| `auth.html` / `admin.html` | Prototype includes user emails in admin/user tables. | Acceptable only in authenticated admin contexts with permission checks. Not acceptable for public verification. |

## 6. Non-Conflicts / Acceptable Prototype Details

- `K7M9QF2-T8N4PZ` style Passport ID examples are aligned with the current no-prefix `XXXXXXX-XXXXXX` decision.
- Certificate number display is allowed on public verification pages, but it is not the same as QR token and should not be the sole source of truth.
- QR or verification URLs are acceptable when they carry only opaque verification codes.
- Certificate valid/expired/revoked/not-found UI states match the required verification lifecycle.
- Admin verification logs, rapid verification alerts, and revoked-certificate alerts align with audit/security goals.

## 7. Implementation Priority From Prototype Gaps

1. Certificate public verification page based on `certificates-verify.html`, with blockchain/admin-note conflicts removed.
2. User certificate portfolio based on `certificates-user.html`, backed by Core certificate issue records.
3. Certificate Admin expansion based on `certificates-admin.html`: dashboard, records, logs, issuing rules, batch issue, applications.
4. Public/profile credential page based on `certificates-profile.html`, respecting privacy settings.
5. Events page featured event card from `events.html`.
6. Home page upcoming events body section from `index.html`.
7. Admin events and application review tables/filters from `admin.html`.
8. Climate Passport subpage visual treatment closer to dashboard passport card from `dashboard.html`.

## 8. Development Rule For Future Prototype Imports

When a new prototype appears in `docs/ui-prototypes/`:

1. Identify which implemented route/component it maps to.
2. Ignore hero/footer for binding comparison.
3. Compare body layout, information hierarchy, controls, density, states, and responsive behavior.
4. Reuse visual structure and interaction patterns where data requirements match.
5. Replace prototype sample data with Core-owned data contracts.
6. Remove any prototype copy that conflicts with current product/security decisions.
7. Record unresolved conflicts in this audit or a newer dated audit before implementation.
