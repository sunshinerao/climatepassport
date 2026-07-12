# Entity Topic French and German Copy - 2026-07-12

## 需求解读

The GEO entity consistency audit found that French and German entity-topic URLs were structurally correct but reused English body content. Climate Passport ID, Verifiable Credentials and Certificate Verification should carry first-class locale-specific copy so AI/search systems can associate the same entity relationships across languages.

## 修改方法

Expand the existing `topicContent` dictionary from English/Chinese only to all supported locales. Preserve section IDs and page structure so anchors, metadata and routing remain stable.

## 修改内容

- Added French and German Climate Passport ID copy covering the platform identity anchor and identity boundary.
- Added French and German Verifiable Credentials copy covering credential records, verification value, portability and sharing.
- Added French and German Certificate Verification copy covering verification purpose, public status checks, privacy and access boundaries.
- Updated `getEntityTopicContent()` to return content for the exact current locale instead of falling back to English for French and German.
- Strengthened the identity boundary copy for Verifiable Credentials and Certificate Verification across en/zh/fr/de.