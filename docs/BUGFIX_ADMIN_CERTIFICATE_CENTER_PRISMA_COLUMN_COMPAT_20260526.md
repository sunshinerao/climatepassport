# 管理后台证书中心 Prisma 列兼容修复

## 需求解读
点击管理后台的证书中心时，服务端报错提示当前数据库缺少 `certificate_categories.autoIssueEnabled` 列，导致页面无法渲染。需要让证书中心兼容当前线上数据库结构，避免默认全字段查询把页面直接打崩。

## 修改方法
把证书中心页面的 Prisma 查询改成显式字段选择，只读取当前数据库中已存在的列，并对证书定义关联分类也使用选择式查询，避免 Prisma 默认展开到不存在的字段。

## 修改内容
- 修改 [apps/passport-web/app/[locale]/admin/certificates/page.tsx](apps/passport-web/app/%5Blocale%5D/admin/certificates/page.tsx)，将证书分类查询从默认全字段改为 `select`。
- 同步修改证书签发记录中证书定义与分类的嵌套查询，避免关联查询再次触发缺失列错误。
- 证书中心页面展示逻辑保持不变，只收紧了数据库读取范围。
