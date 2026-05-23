# Passport Web Content Cleanup 2026-05-20

## 需求解读

- 页面文案中不能再出现 SHCW2026 相关内容。
- 页面文本不能使用开发过程提示语（如 baseline、mock、迁移说明、framework 等）。
- 应用需要可运行，必须验证编译与本地访问状态。

## 修改方法

- 全量扫描 `passport-web` 页面文案主入口，重点处理 `site-content.ts`、页面组件、站点壳层。
- 清理所有 SHCW2026 相关展示词和开发阶段提示词，统一为正式平台运营文案。
- 修复本地运行阻塞：移除 `next/font/google` 依赖，改为本地字体栈，避免网络导致构建失败。
- 重建并复核：执行生产构建，重启 dev 服务并抽查页面访问。

## 修改内容

- 更新 `apps/passport-web/lib/site-content.ts`
  - 移除 SHCW/上海气候周相关展示文案
  - 移除 baseline/mock/migration/framework 等开发过程口径
  - 统一中英文首页、Passport、Events、Notifications、Messages、Info、Auth 文案为运营口径
- 更新 `apps/passport-web/components/site-shell.tsx`
  - 头部副标题改为中性平台描述，不再出现 SHCW2026
- 更新 `apps/passport-web/components/platform-screens.tsx`
  - 移除页面中的开发提示词（如 Mock）及 SHCW 说明文本
- 更新 `apps/passport-web/app/layout.tsx`
  - 移除 Google Fonts 远程加载，改为本地字体栈
  - 更新 metadata 描述为正式平台描述
- 运行验证
  - `npm run build --workspace passport-web`：通过
  - dev 服务可启动，页面路由可访问（`/en`、`/zh`、`/en/auth/login`）
