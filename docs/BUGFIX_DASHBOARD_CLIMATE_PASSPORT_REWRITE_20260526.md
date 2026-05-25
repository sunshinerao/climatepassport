# 需求解读
将 `dashboard/climate-passport` 页面主体重写为与提供的 `dashboard.html` 视觉结构严格对齐，同时保留现有站点壳层（header/footer）不改动。样式实现需并入现有项目样式体系，避免单独新建孤立样式文件。

# 修改方法
1. 保持路由与页面壳层不变，仅重写 `ClimatePassportScreen` 页面主体结构。
2. 以上传 HTML 的信息架构为基准，映射为当前 React 组件结构：欢迎区、Passport 主卡、快捷统计、近期日程、最近证书、资料完整度、成就、快捷操作。
3. 将新样式追加到已有 `dashboard-redesign.css` 中，继续复用全局设计变量（颜色、圆角、阴影、字号）保证整体一致性。

# 修改内容
- 重写页面主体：`apps/passport-web/components/platform-screens.tsx`
  - 改写 `ClimatePassportScreen` 输出结构为双栏 dashboard 布局。
  - 保留现有数据来源（`getPassportPageData`），并补充页面展示所需静态/半静态块（时间线、证书卡片、快捷操作）。
  - 未改动 header/footer，仍由 `SiteShell` 统一渲染。
- 样式并入现有体系：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 新增 `passport-dashboard` 相关样式组。
  - 使用项目现有变量（`--cp-*`）保持视觉语气一致。
  - 完成响应式规则，适配桌面与移动端。

# 本次追加（绿色块二次对齐）

## 需求解读
参考 auth/login 页面左侧绿色渐变视觉风格，重写 climate-passport 页面的绿色主块；并将绿色块内部信息排版对齐上传 `dashboard.html` 中对应 Climate Passport 卡片结构。

## 修改方法
1. 在 `ClimatePassportScreen` 中将绿色块替换为独立前缀类结构，避免旧类名样式串扰。
2. 在 `dashboard-redesign.css` 中新增 `passport-dashboard-hero-*` 样式组，复用 auth/login 的渐变与网格叠层实现。
3. 按上传 HTML 对齐块内结构：标题、姓名、角色、三项统计、ID、右侧二维码与标签。

## 修改内容
- 结构重写：`apps/passport-web/components/platform-screens.tsx`
  - 将绿色块由通用 `passport-*` 结构切换为 `passport-dashboard-hero-*` 结构。
  - 统计信息改为 3 列展示块，版式与原型对应区域一致。
  - 二维码区域改为固定框+图案占位，位置对齐主卡右侧。
- 样式重写：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 新增 auth/login 同源渐变：`linear-gradient(135deg, #12382f 0%, #1f5a4e 62%, #89a99a 160%)`。
  - 新增网格叠层、光晕装饰、统计块半透明玻璃效果。
  - 新增移动端断点规则，主卡在窄屏改为单列并保持可读性。

# 本次追加（对齐细节微调）

## 需求解读
继续微调绿色块，目标是尽可能贴近参考图中的视觉比例与层次，包括网格强度、信息块尺寸、ID 字体气质与二维码区域位置。

## 修改方法
1. 保持绿色块数据结构不变，仅调整视觉参数（间距、字号、圆角、透明度、阴影）。
2. 将二维码容器改为底部居中浮层，模拟参考图中的叠层关系。
3. 在移动端保持可读性优先，覆盖桌面大字号与大尺寸二维码设置。

## 修改内容
- 微调样式：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 主卡 padding 调整为上/左右更宽、底部预留二维码空间。
  - 网格叠层透明度和网格尺寸上调，增强参考图中的背景格线感。
  - 姓名、角色、统计胶囊、ID 字号与间距全部放大并重排。
  - 二维码区域改为底部居中悬浮组合，并新增前后层级关系。
  - 补充对应移动端缩放规则，避免小屏溢出与信息拥挤。

# 本次追加（绿色区收敛 + 可验证二维码）

## 需求解读
针对 `dashboard/climate-passport` 左上绿色区进行重新收敛：高度缩减约三分之一、去掉格子线、内容排版贴近最新截图；同时二维码不再使用装饰图案，而是承载可验证身份信息与基础资料。

## 修改方法
1. 重设绿色主卡布局为左右双列，左侧信息、右侧二维码，移除网格叠层和统计块容器样式。
2. 在服务端页面渲染阶段签发 `IDENTITY` 类型短时 QR token，并将验证链接编码为真实二维码图像。
3. 在 `api/qr/identity` 新增公开 `GET` 校验入口，扫码后可返回 token 有效性与用户基础信息。

## 修改内容
- 页面结构与数据：`apps/passport-web/components/platform-screens.tsx`
  - 绿色区统计项改为纯文本指标（无块背景）。
  - 引入 `qrcode` 生成真实二维码图片（data URL）。
  - 引入 `issueQrToken` 和 `getIdentityQrExpiry`，在页面请求时生成短效可验证 token。
  - 二维码内容改为 `/api/qr/identity/verify?token=...` 验证地址。
- 验证接口：`apps/passport-web/app/api/qr/identity/route.ts`
  - 新增 `GET`：校验 token 状态、过期状态与用户基础信息（姓名、角色、Climate Passport ID）。
  - 保留既有 `POST` 发放逻辑不变。
- 样式重构：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 绿色区高度显著收敛，移除格子线叠层。
  - 重排字号、间距、二维码卡片尺寸，和截图视觉更贴近。
  - 更新移动端规则，确保二维码与文本在窄屏不溢出。

# 本次追加（全页字体与字号对齐首页）

## 需求解读
对 `dashboard/climate-passport` 页面进行全面字体与字号检查，参考首页排版体系，将本页所有可见文本的字体家族和字号层级对齐到首页标准。

## 修改方法
1. 以首页已使用的字号梯度为基线（0.75 / 0.8125 / 0.9375 / 0.96 / 1.25 / 1.7 / 2.125 / 2.35）。
2. 将本页 `passport-dashboard-*` 相关选择器中的硬编码像素大字号统一替换为上述层级和 `clamp` 区间。
3. 字体家族对齐首页规则：标题使用 serif 体系（含中英文字体回退），正文使用全局 sans，ID 使用 monospace。

## 修改内容
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 调整欢迎区、卡片标题、绿色主卡标题/姓名/角色/统计/ID、时间线、证书、进度、徽章、快捷操作等全部文本字号。
  - 将多个超大像素字号（如 50+px）回收至首页一致比例。
  - 统一标题字体回退链为 `Georgia + Noto/Source Han Serif`，正文和按钮字号对齐首页小中字号。

# 本次追加（数据来源审查与真实化补齐）

## 需求解读
全面审查 `dashboard/climate-passport` 页面所有数据与文案，确定真实数据来源、识别断点（硬编码/错误链路/空数据场景），并补齐为可落地的真实信息展示。

## 修改方法
1. 从 `getPassportPageData` 统一下沉页面数据，避免组件内硬编码数组。
2. 用数据库关系查询替换静态时间线与证书示例，增加空数据兜底文案。
3. 修复二维码验证链路断点（路径不一致），并保持 token 可验证。

## 修改内容
- 数据层：`apps/passport-web/lib/server/platform-data.ts`
  - 新增真实数据结构输出：`timeline`、`certificates`、`profileCompletion`。
  - `timeline` 来源：用户注册记录 + 未来已发布活动。
  - `certificates` 来源：用户已签发证书（含定义名称、签发日期、验证链接）。
  - `learningHours` 改为基于已参加活动时长计算（带快照兜底）。
  - 新增 `account.certificates` 字段，修复页面“证书数量”误用成就数量的问题。
- 页面层：`apps/passport-web/components/platform-screens.tsx`
  - 移除硬编码时间线与证书样例，改为消费 `getPassportPageData` 返回数据。
  - 新增空数据显示状态，避免无数据时页面断层。
  - 二维码验证链接修正为 `/api/qr/identity?token=...`。
- 样式层：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 新增时间线与证书空状态样式，保证断点场景的可读性与一致性。

# 本次追加（人可读身份验证页）

## 需求解读
为 Climate Passport 二维码增加人可读验证页面，扫码后不再只返回 JSON，而是展示可理解的验证状态与核心身份信息。

## 修改方法
1. 抽离 identity QR 验证逻辑到服务端公共模块，避免 API 与页面重复实现。
2. 新增本地化验证页面路由，展示 VALID / INVALID 状态、基础身份信息、签发/过期时间。
3. 将 dashboard 的二维码目标链接切换到人可读页面，仍通过同一套 token 校验机制验证。

## 修改内容
- 验证逻辑抽离：`apps/passport-web/lib/server/identity-qr-verification.ts`
  - 新增 `resolveIdentityQrVerification(token)`。
  - 统一返回状态：`VALID` / `INVALID` / `MISSING_TOKEN` / `UNAVAILABLE`。
- API 复用：`apps/passport-web/app/api/qr/identity/route.ts`
  - `GET` 改为调用统一 resolver，输出 JSON 保持可机读接口能力。
  - `POST` 继续用于登录后签发 token。
- 新增人可读页面路由：
  - `apps/passport-web/app/[locale]/verify/identity/page.tsx`
  - `apps/passport-web/app/verify/identity/page.tsx`（无 locale 入口重定向）
- 链接切换：`apps/passport-web/components/platform-screens.tsx`
  - 二维码内容由 `/api/qr/identity?token=...` 改为 `/{locale}/verify/identity?token=...`。
- 页面样式：
  - 新增 `apps/passport-web/app/styles/features/identity-verify.css`
  - 并在 `apps/passport-web/app/globals.css` 注册导入。

# 本次追加（验证页体验升级）

## 需求解读
继续下一步优化，把新增的人可读身份验证页提升到证书验证页同等级的信息密度和可读性，增加状态图示、核验摘要与失败处理引导。

## 修改方法
1. 在身份验证页引入状态元信息模型（通过/失败图示、标题、副文案）。
2. 将页面拆分为身份信息区与核验摘要区，明确“结果”和“审计上下文”。
3. 对失败状态按类型输出可操作提示，并展示 token 摘要与状态码，便于排障。

## 修改内容
- 页面逻辑：`apps/passport-web/app/[locale]/verify/identity/page.tsx`
  - 增加状态图标与头部结构（VALID/INVALID）。
  - 增加“身份信息”与“核验摘要”双区块。
  - 增加 token 摘要展示（mask）与失败场景提示列表。
- 样式升级：`apps/passport-web/app/styles/features/identity-verify.css`
  - 新增状态圆形图标、分区标题、错误提示列表、审计摘要样式。
  - 完善移动端布局（状态头在窄屏自动改单列）。

# 本次追加（公开最小披露验证模式）

## 需求解读
继续下一步，面向“扫码公开展示”场景降低隐私暴露风险：验证页在公开模式下应保留可验证性，同时只暴露最小必要身份信息。

## 修改方法
1. 在本地化验证页增加 `public` 查询参数识别能力，进入最小披露渲染分支。
2. 对敏感字段进行脱敏展示（姓名、Passport ID），并保留验证结果和必要审计信息。
3. 将 dashboard 生成的二维码默认链接切换为 `public=1`，确保实际扫码入口默认走公开模式。
4. 无 locale 的验证入口路由增加 `public` 参数透传，避免入口转换丢失模式。

## 修改内容
- 公开模式逻辑：`apps/passport-web/app/[locale]/verify/identity/page.tsx`
  - 新增 `isPublicMode` 解析（`public=1/true`）。
  - 新增 `maskName`、`maskPassportId` 脱敏函数。
  - 公开模式展示“公开身份摘要”，并附最小披露提示文案。
- 样式：`apps/passport-web/app/styles/features/identity-verify.css`
  - 新增 `idv-privacy-note` 提示样式。
- 无 locale 入口透传：`apps/passport-web/app/verify/identity/page.tsx`
  - 将 `public` 查询参数透传到 `/en/verify/identity`。
- 二维码默认公开模式：`apps/passport-web/components/platform-screens.tsx`
  - 验证链接改为 `/{locale}/verify/identity?token=...&public=1`。
