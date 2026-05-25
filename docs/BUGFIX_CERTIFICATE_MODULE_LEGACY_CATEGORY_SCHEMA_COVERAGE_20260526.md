# 证书模块旧库分类结构全链路兼容修复

## 需求解读
用户点击证书中心仍出现 `certificate_categories.autoIssueEnabled` 缺失错误，说明兼容范围不能只覆盖证书中心首页，还要覆盖分类与模板相关页面，避免在子页面再次触发 Prisma 对缺失列的映射。

## 修改方法
将证书模块中所有读取 `certificate_categories` 的关键页面统一改为基于稳定旧列的原生 SQL 查询，不再使用 `certificateCategory.findMany` 直接映射模型字段；分类统计采用定义/模板分组计数拼装。

## 修改内容
- 修改 [apps/passport-web/app/[locale]/admin/certificates/categories/page.tsx](apps/passport-web/app/%5Blocale%5D/admin/certificates/categories/page.tsx)
  - 分类列表读取改为 `queryRaw`。
  - 内置分类初始化改为 `executeRaw INSERT ... WHERE NOT EXISTS`。
  - 模板数/定义数改为 `groupBy` 后映射。
- 修改 [apps/passport-web/app/[locale]/admin/certificates/templates/page.tsx](apps/passport-web/app/%5Blocale%5D/admin/certificates/templates/page.tsx)
  - 分类下拉读取改为 `queryRaw`。
- 修改 [apps/passport-web/app/[locale]/admin/certificates/templates/[id]/page.tsx](apps/passport-web/app/%5Blocale%5D/admin/certificates/templates/%5Bid%5D/page.tsx)
  - 分类下拉读取改为 `queryRaw`。
