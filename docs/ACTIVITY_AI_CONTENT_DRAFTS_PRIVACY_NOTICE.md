# Activity AI content drafts: privacy notice

**Status: local code and local migration only.** The feature is disabled unless an operator explicitly sets `AI_CONTENT_ASSIST_ENABLED=true`; no production enablement is claimed.

When an ADMIN requests a draft, the server—not the browser—selects only the requested locale's public Activity title, subtitle, summary, and description. Each field and total input are length-bounded. The service does not send internal IDs, user or applicant data, participation, speakers, agenda, community posts, certificates, portfolios, uploads, browser-derived data, prompts supplied by users, or secrets.

The database stores a generated/editable JSON draft, source hash and aggregate field/character counts, lifecycle timestamps, configured provider/model aliases, and a sanitized failure code. It never stores prompts, provider raw output, provider error bodies, API keys, or provider secrets. Audit records contain lifecycle action, kind/locale, and aggregate counts only.

No output is automatically published or used to make moderation, matching, scoring, recommendation, eligibility, profiling, or other user-impacting decisions. A human ADMIN must approve and explicitly confirm publication. Draft deletion or retention purge does not alter already-published Activity content. See `ACTIVITY_AI_CONTENT_DRAFTS_PHASE4.md` for operational safeguards and retention command.
