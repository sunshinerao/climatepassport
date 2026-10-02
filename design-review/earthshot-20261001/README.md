> 当前可看版本为第二轮 Platform。最新字号、渐变、交互与 QA 见 [V2-REVIEW.md](V2-REVIEW.md)。以下保留第一轮研究记录；Programme 取舍已被用户最新要求覆盖。

# CP visual review — 2026-10-01

Review only; independently served static pages. Production routes and business rules are untouched.

Open http://127.0.0.1:4340/ , /passport.html , /activity.html . Restart with `python3 -m http.server 4340 --bind 127.0.0.1 --directory design-review/earthshot-20261001` from the repository root.

## Reference evidence and decisions

The public Earthshot home was examined in the user's native Chrome at desktop and mobile sizes, including actual screenshots, menu, scrolling, and native DevTools styles. Observed: deep forest hero, large editorial typography, documentary mosaic opposite the headline, broad quiet sections, alternating light/dark bands, pill actions, restrained navigation. Mobile places the imagery above the heading and uses a compact menu. Public extraction is under `.superdesign/website/earthshotprize.org/`; native visible observations take precedence where automated analysis differs.

CP uses its own existing wordmark and crest from `docs/ui-prototypes/`. Earthshot photography, logo and copy are not reused. No authorized documentary photography was found in the local assets. The hero therefore shows a specifically designed CP passport cover, and the activity uses an editorial event poster explicitly marked as awaiting authorized imagery. This is a deliberate media exception, not a completed photographic Programme treatment.

Home translates the reference's scale and quiet section rhythm. Passport and event details use denser readable rows, structured facts and clear actions: a page-level product adaptation. Original Chinese mission copy remains central. The user must approve this candidate before site-wide implementation.

## Standards actually read

Local `../my-standards`, VERSION 1.1.1, commit `8be9f7f980d42fbb1e9ec73efd5f7af61f22a5c8`; global foundation, Programme and Platform design/interaction rules, AI build rules and reference registry. No CP-specific standards pin was found. Candidate tokens use Programme forest #174C3B, background #F5F6F1, ink #10201B, soft #42514B, lime #C7E86B and sand #E7DFC9; square media, pill actions and 1320px content cap. Arial/PingFang are system fallbacks; no license for Earthshot's GT America was assumed. Global standards files were not changed.

## Content / feature mapping

| Existing source | Review treatment | Future production preservation |
|---|---|---|
| HomeScreen / site-content home mission | Original headline and supporting Chinese mission, identity / participation / credentials hierarchy | Existing locale copy, discovery, creation and authentication destinations |
| ClimatePassportScreen | Identity cover, participation rows, credentials and achievements tabs, edit/share/credential preview dialogs | Real profile fields, statistics, public identity URLs and verification rules |
| Activity slug route / event-detail-sections | Existing static Climate Systems Forum 2026 title, date, Shanghai venue and conference type; summary, agenda, requirements and registration preview | DB activity state, enrollment, task submission, check-in, certificates, speakers, community and leaderboard relationships |
| SiteShell | Existing CP brand; representative home/activity/credential/passport navigation | Full production footer, legal, locale, settings, account and administrative navigation |

Synthetic participant `演示参与者 01`, metrics and participation history are clearly demo data. June 2026 event dates are retained as past examples and not falsely advertised as open registration. Speaker details and photographic media are explicitly pending. No new real people or awards are invented.

## Interaction and verification

Native Chrome desktop 1440px and phone 390px layouts examined for all three pages; tablet 768px home examined and corrected to a single column with menu. No horizontal overflow was visible in inspected phone views. Native mobile menu and Escape focus restoration, profile edit dialog and demo response were exercised. Activity registration dialog and checkbox exercised; no request can leave the page: CSP `connect-src 'none'`, `form-action 'none'`, and submit prevention. Tabs have keyboard arrow navigation; native dialogs provide focus trapping and restore the opener. Saved state is memory-only. No real QR/link, booking, profile mutation or certificate is issued.

JS syntax check passed. Calculated WCAG foreground/background ratios: ink/background 15.54:1, soft/background 7.70:1, light/forest 9.06:1, ink/lime 12.20:1. Visible focus outlines and 44px minimum key controls are included. Reduced-motion CSS disables smooth scrolling, transitions and animations. Supplementary native Chrome checks completed at 768px for all three pages with Rendering > prefers-reduced-motion: reduce. The browser Styles panel showed the active media rule (scroll-behavior:auto, transition:none, animation:none); menus, page navigation, Passport tabs including keyboard arrows, credential/share/edit dialogs, activity registration demo response, favorite toggle and agenda disclosure were exercised. Escape restored opener focus. Emulation was returned to No emulation afterward. No design/code changes were needed during this supplementary pass. This is not an accessibility certification or full product regression. The existing 809-case backend regression was not rerun or modified for this isolated visual candidate.

Three full-page 1440px screenshots are under `screenshots/` and saved to native ChatGPT Library. They exclude browser chrome and private tabs.

## Preservation and service limitation

Final SHA256 comparison against `/tmp/cp-design-preserve.json`: all 1109 original files unchanged; Git HEAD and index unchanged. Only this review directory and `.superdesign` analysis artifacts were created. No database, environment, secret, authentication, mailer, SSO, production routing, deployment or push changes.

Superdesign public extraction and an empty project were available. Automatic approval review rejected importing CP-branded authored content to the external Superdesign service because external sharing was not authorized. No design was uploaded; no completed external canvas is claimed. The approved local-authoring route supplies the complete reviewable prototype. An external canvas would require explicit approval for that destination and content.

## Preview lifecycle

The current loopback-only Python preview process is PID 25622, tools exec session 22039. It is kept running for user review, with no launch agent, daemon, startup or persistent system configuration. To stop after confirming the PID still owns port 4340, run `kill 25622`. Restart using the command above. No new screenshots or Library identities were created during supplementary verification.
