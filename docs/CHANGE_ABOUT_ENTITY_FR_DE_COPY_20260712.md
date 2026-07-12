# About Entity French and German Copy - 2026-07-12

## 需求解读

The GEO entity consistency audit found that French and German About URLs were structurally correct but reused English body content. For multilingual SEO/GEO, locale-aware URLs should carry first-class locale-specific entity definitions.

## 修改方法

Extend the existing About entity content arrays with French and German sections while preserving the existing component structure, section IDs, entity concepts and identity boundary language.

## 修改内容

- Added French About entity definition, Climate Passport ID, identity boundary, verifiable credentials, growth profile and institutional use sections.
- Added German About entity definition, Climate Passport ID, identity boundary, verifiable credentials, growth profile and institutional use sections.
- Localized the About page header label and H1 for zh/fr/de instead of using the English header on every non-Chinese page.