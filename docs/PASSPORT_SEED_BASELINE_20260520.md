# Climate Passport Seed 基线记录

## 需求解读

- 继续推进 Climate Passport，不能只停留在 Prisma schema 和查询入口阶段。
- 需要补一套最小但完整的 seed 基线数据，让 Passport、Events、Certificates 这些已接 Prisma 的页面在数据库准备好后能直接显示真实平台数据。
- 这套 seed 要优先服务当前验证路径，并保持与既定迁移方向一致。

## 修改方法

- 新增 `prisma/seed.mjs`，使用 Prisma Client 生成平台基线数据。
- 优先覆盖当前已接入 Prisma 的关键页面所需实体：用户、机构、活动、报名、签到、积分、成就、证书。
- 在根目录加入 `db:seed` 命令，便于后续本地数据库就绪后直接执行。

## 修改内容

- 更新 `package.json`，新增 `db:seed` 和 Prisma seed 配置
- 新增 `prisma/seed.mjs`
- 新增 `docs/PASSPORT_SEED_BASELINE_20260520.md`