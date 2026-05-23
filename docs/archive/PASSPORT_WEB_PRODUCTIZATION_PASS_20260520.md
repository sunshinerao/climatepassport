# Passport Web Productization Pass 2026-05-20

## 需求解读

- 当前主线是 climate-passport，不再在 my-app 分支上做功能推进。
- 用户要求页面风格向上海气候周视觉语言靠齐，并且平台呈现必须是“可运营系统”而不是“演示样页”。
- 改动应保持现有可运行闭环与路由结构，不引入破坏性重构。

## 修改方法

- 在不改路由结构和核心组件分层的前提下，先做一轮全局视觉系统升级：统一背景层次、品牌色关系、头部品牌语义和按钮气质。
- 同步替换首页与认证关键文案，把“baseline/mock/demo”口吻替换成平台运营口径。
- 维持现有模块数据入口，优先做“视觉与叙事产品化”，并在 tracker 中登记完成项。

## 修改内容

- 更新 `apps/passport-web/app/globals.css`
  - 调整全局色板、阴影、背景渐变与顶部栏质感
  - 新增品牌副标题样式 `brand-subtitle`
  - 调整 hero、badge、button、passport-card、footer 的视觉表达
- 更新 `apps/passport-web/components/site-shell.tsx`
  - 在品牌区域增加 `SHCW 2026 Platform Layer` 副标题
- 更新 `apps/passport-web/components/platform-screens.tsx`
  - 首页模块入口按钮文案改为本地化的产品化表达（`Open module` / `进入模块`）
- 更新 `apps/passport-web/lib/site-content.ts`
  - 首页与页脚关键叙事改为运营口径
  - 登录/注册文案由“mock/baseline”改为可上线语气
  - 中英文同步更新
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
  - 新增 `CP-TODO-045` 并标记 `done`
