# UI Prototype Redesign 2026-05-21

## 需求解读
用户要求基于 docs/ui-prototypes 中已确认的原型，统一更新站点核心页面 UI（首页、活动页、认证页、站点导航与页脚），并保持 Next.js 前后端可运行、可构建、可测试。

## 修改方法
1. 先完整读取 prototype HTML（dashboard/events/admin）并提炼设计令牌与布局模式。
2. 在不破坏既有业务 API 和鉴权逻辑的前提下，仅调整视图层结构与样式层。
3. 采用“增量覆盖”方式：
   - 更新 `components/site-shell.tsx` 的导航与页脚结构
   - 更新 `components/platform-screens.tsx` 的 Home/Events/Login/Register 结构
   - 在 `app/globals.css` 末尾增加 prototype 对齐样式覆盖层
4. 保持 summer-school 页面最小头尾模式逻辑不变，避免回归。

## 修改内容
1. 站点壳层重构：
   - 顶栏简化为 prototype 风格品牌 + 导航 + 操作区
   - 登录态/管理员态按钮重排
   - 页脚改为 4 列结构（Brand/Navigate/Info/Contact）+ 底部法务栏
2. 首页重构：
   - 新增 prototype hero（Georgia 标题、强调词、右侧 Passport 视觉卡）
   - 新增深色统计条与三列能力卡片
   - 新增底部 newsletter CTA 区块
3. 活动页重构：
   - 新增 prototype 风格页头与筛选胶囊
   - 新增卡片化活动栅格（视觉图 + 内容区）
   - 保留 agenda 列表，统一样式层
4. 认证页重构：
   - 登录/注册页改为 split-screen 结构
   - 增加 Sign In / Create Account tab 风格切换入口
5. 样式系统对齐：
   - 增补 prototype 颜色变量（forest/moss/amber/cream）
   - 覆盖 topbar/footer/home/events/auth 关键样式与响应式
6. 构建验证：
   - 已执行 `npm run build`，通过（Next.js 14，82/82 页面生成成功）。

7. Dashboard 重构（第二轮）
   - 按 dashboard 原型重构为三栏布局：Passport 主卡、主内容列、右侧成就/快捷操作列
   - 保留真实用户数据读取：积分、证书、通知、报名记录、成就数量
   - 新增近期时间线、证书归档区、成就墙与资料完整度 KPI 区块

8. Admin 重构（第二轮）
   - 按 admin 原型重构为控制台结构：左侧导航栏 + 右侧主工作区
   - 保留真实角色门禁与数据：角色、可管理活动、已发布活动、审批活动数量
   - 新增近期活动队列与模块入口卡片（Events / Learning Experiences / Certificate Hub）

9. 样式扩展（第二轮）
   - 在 `app/globals.css` 增补 dashboard/admin 原型样式族
   - 增补移动端/平板响应式规则，确保桌面与移动布局可用

10. 二次构建验证：
   - 再次执行 `npm run build`，通过（Next.js 14，82/82 页面生成成功）。

## 11. 第三轮：P0+P1+P2 全量收口

### 需求解读（追加）
基于 prototype 与实现的全量审计，按 P0/P1/P2 优先级一次性完成全部差距修复，覆盖：数据真实化（成就/资料完整度）、原型布局补全（auth 左面板、admin 侧栏、home 三步、events 客户端过滤+往期、dashboard 圆环+日期方块）、字典化与视觉打磨。

### 修改方法（追加）
- Dashboard 改为同时查询 `AchievementDefinition` + `UserAchievement` 实现徽章真实化；通过完整 user select 计算 `profileCompletion`（avatar/phone/country/bio 等 8 字段）。
- 抽离 `components/events-filterable-grid.tsx` 客户端组件承担 filter 交互，server 端继续负责数据。
- Auth 左面板通过 CSS blob 装饰 + 内联价值列表 + testimonial 实现 prototype 视觉。
- Admin sidebar 改为分区导航（Operate / Personal）+ 活动态左侧 amber 竖条。
- 在 `site-content.ts` 增 `shell.actions` 字典，site-shell 取消所有内联三元。
- `app/globals.css` 追加 v3 区块，覆盖：圆环 SVG、日期方块、徽章 3 列 + locked 灰度、how-it-works、auth 装饰、admin 侧栏、navbar 滚动阴影、按钮渐变、搜索图标、featured 卡、past-events 列表与全部响应式。

### 修改内容（追加）
1. P0-1 Dashboard 徽章接入真实 `AchievementDefinition` + `UserAchievement`，按 unlocked/locked 渲染。
2. P0-2 Dashboard `profileCompletion` 改为基于 Prisma 全字段 select（8 字段）。
3. P1-3 Auth 左面板加 blob 装饰、value list、testimonial。
4. P1-4 Admin sidebar 加分区导航（Operate / Personal）+ active 视觉。
5. P1-5 Home 加 "How It Works" 三步区 + hero radial 装饰。
6. P1-6 Events 改为客户端 filter（含 count badge）+ Featured 卡 + Past Events 列表 + 搜索框（带 SVG 图标）。
7. P1-7 Dashboard 加圆环 SVG profile completion + 56×56 日期方块 + 3 列徽章网格 + locked 灰度。
8. P1-8 site-shell nav 操作按钮全部走 dictionary（去除内联三元）。
9. P2 navbar `.scrolled` 阴影、`.button-amber` 统一渐变、徽章 hover 提升、past-events 卡 hover、event card hover translateY。

### 三次构建验证
- 第三轮执行 `npm run build`，通过（Next.js 14，全部页面生成成功，无 TS 错误）。
