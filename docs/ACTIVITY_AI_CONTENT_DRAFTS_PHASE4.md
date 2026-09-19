# Phase 4 Activity AI content drafts

This bounded feature is **disabled by default** (`AI_CONTENT_ASSIST_ENABLED=false`) and is not a chat, RAG, matching, scoring, recommendation, moderation, profiling, upload, or browsing feature.

Only an authenticated `ADMIN` may request a draft for one exact activity and locale. The sole supported configured provider is OpenAI through native `fetch`; there is no SDK, fallback, or retry. Configuration, provider availability, timeout, input/output sizes, output JSON shape, generation rate limits, and per-admin/activity daily budgets fail closed.

The provider receives only bounded public activity title, subtitle, summary, and description for the requested locale. It never receives IDs, users, applicants, participation, speakers, agenda, community, certificates, portfolio, or provider secrets. Prompts, raw provider output, errors, and secrets are never stored. Stored audit metadata is limited to draft kind, locale, generic source field/character counts, and sanitized failure codes.

Generation creates an isolated draft and **never changes Activity**. An ADMIN may edit generated content, approve it, and explicitly confirm publication. Publication is transactional and only maps `HIGHLIGHTS` arrays to `highlights` (zh) or `highlightsEn` (en); summary and overview copy map to their locale-specific Activity fields. Existing public content is untouched until this final step. Deleting or purging drafts never changes published Activity content.

`npm run purge:activity-ai-content-drafts` is a dry run. Pass `-- --apply` to permanently remove expired or deleted drafts older than 30 days. Migration is local-only and must not be deployed without external security/privacy review and provider approval.
