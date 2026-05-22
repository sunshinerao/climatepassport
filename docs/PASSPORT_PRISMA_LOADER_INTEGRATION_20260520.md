# Passport Prisma Loader 接入记录

## 需求解读

- 继续推进 Climate Passport，不能停留在只定义 schema 和 mock loader 的状态。
- 现阶段最合适的下一步，是把 `passport-web` 的服务端 loader 接到 Prisma 查询入口。
- 同时不能因为数据库尚未准备好就阻断当前验证，因此需要保留安全回退。

## 修改方法

- 新增 Prisma 单例入口，供 `passport-web` 服务端 loader 统一使用。
- 更新首页、Passport、Certificates、Events 的 loader：优先查询 Prisma，失败时回退到现有 mock 内容。
- 不修改页面组件结构，只替换数据来源。

## 修改内容

- 新增 `apps/passport-web/lib/server/prisma.ts`
- 更新 `apps/passport-web/lib/server/platform-data.ts`
