# Passport Web 服务端数据层抽离记录

## 需求解读

- 按照既定顺序进入第 2 步，需要让页面开始通过服务端数据层取数，而不是直接依赖静态内容模块。
- 当前数据库还没有正式接通，因此这一步的目标不是一次性上真实数据，而是先建立稳定的 server loader 边界。
- 后续 Prisma 接入时，应优先替换 loader 实现，尽量不冲击已经验证过的页面结构。

## 修改方法

- 新增 `apps/passport-web/lib/server/platform-data.ts`。
- 把首页、Passport、Certificates、Events、Login、Register 的页面数据改为通过服务端 loader 获取。
- 保持现有页面外观和内容不变，只调整数据读取路径。

## 修改内容

- 新增 `apps/passport-web/lib/server/platform-data.ts`
- 更新 `apps/passport-web/components/platform-screens.tsx`