# Organization JSON-LD LinkedIn sameAs Update

## 需求解读

将 Climate Passport 的 LinkedIn 公司主页加入 Organization JSON-LD 的 `sameAs`，并让 `sameAs` 只保留该 LinkedIn URL。官网继续通过 Organization JSON-LD 的 `url` 字段表达。

## 修改方法

在集中 SEO/JSON-LD 工具中调整 `organizationJsonLd()` 的 `sameAs` 输出，避免页面级重复修改，保持全站结构化数据统一。

## 修改内容

- 将 `sameAs` 从自引用的 `https://www.climatepass.org` 改为 `https://www.linkedin.com/company/climate-passport/`。
- 保留 Organization JSON-LD 的 `url`、`@id`、`name`、`email` 和统一 `description` 不变。