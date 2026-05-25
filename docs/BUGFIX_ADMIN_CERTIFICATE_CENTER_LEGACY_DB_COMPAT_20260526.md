# 管理后台证书中心旧库兼容修复

## 需求解读
点击证书中心时报 Prisma P2022，提示 `certificate_categories.autoIssueEnabled` 列不存在。说明运行中的数据库结构落后于当前 Prisma 模型，导致页面在查询证书分类时直接崩溃。

## 修改方法
将证书中心首页中对证书分类的读取改为显式 SQL（只查询旧库稳定存在的字段），并用分组统计补齐模板数与定义数，避免 Prisma 在该模型上默认映射到缺失列。

## 修改内容
- 修改 [apps/passport-web/app/[locale]/admin/certificates/page.tsx](apps/passport-web/app/%5Blocale%5D/admin/certificates/page.tsx)：
  - 证书分类读取改为 `prisma.$queryRaw`，只取 `id/key/name/nameEn/description/isActive`。
  - 通过 `certificateTemplate.groupBy` 与 `certificateDefinition.groupBy` 计算分类计数。
  - 页面展示结构不变，仅替换数据来源与计数拼装方式。
