# BUGFIX: 首页 Hero 布局比例、标题注解与媒体轮播（2026-05-25）

## 需求解读

- 首页首屏 Hero 左右栏比例需要调整为 6:4。
- 中文主标题“属于你的气候时代的可信档案”需要保持单行展示，并自动适配桌面端与移动端。
- “气候时代”不使用斜体；其 hover tips 需与鼠标触发词左侧对齐。
- 右侧原 Climate Passport 卡片改为可自动循环播放的展示空间（图片轮播）。

## 修改方法

- 在 Hero 栅格层改为 `6fr 4fr`，保留响应式小屏单列规则。
- 对中文主标题增加专用类，使用 `clamp()` 做字号自适配，并强制单行。
- 将“气候时代”改为普通文本标注，移除斜体语义；tips 定位改为左对齐。
- 新增 3 张本地 SVG 轮播图作为右侧媒体资源，使用纯 CSS 动画自动循环播放。

## 修改内容

- 修改文件：`apps/passport-web/components/platform-screens.tsx`
  - 中文 Hero 标题启用 `proto-title-zh-single-line`。
  - “气候时代”改为 `hero-term-text`，保留注解 tooltip。
  - 右侧 `passport-card-visual` 替换为 `hero-media-loop` 自动轮播区域。
  - 新增 3 个轮播帧配置，分别引用 `/hero-loop-identity.svg`、`/hero-loop-events.svg`、`/hero-loop-certificates.svg`。
- 修改文件：`apps/passport-web/app/globals.css`
  - Hero 栅格比例改为 `6fr 4fr`。
  - 新增 `proto-title-zh-single-line` 单行自适配规则（桌面与移动端）。
  - `hero-term-tooltip` 从居中改为左对齐；新增 `hero-term-text` 去斜体。
  - 新增 `hero-media-loop`、`hero-media-slide*`、`hero-media-progress` 与对应 keyframes，实现自动循环。
- 新增文件：
  - `apps/passport-web/public/hero-loop-identity.svg`
  - `apps/passport-web/public/hero-loop-events.svg`
  - `apps/passport-web/public/hero-loop-certificates.svg`

## 二次修正（hover tips 与间距）

- 根据用户补充要求，`气候时代` 颜色显式保持继承色，不做单独着色。
- 将中文单行标题与下方副标题（“为地球，为自己，为未来”）间距提升到 2 倍：
  - 桌面 `margin-bottom` 调整为 `32px`；
  - 移动端对应调整为 `24px`。
- 保持 tooltip 容器宽度规则不变（`width: min(560px, 84vw)`），并强制文字在容器内换行：
  - 新增 `white-space: normal; word-break: break-word;`。

## 三次修正（气候时代颜色）

- 根据用户补充要求，将“气候时代”四个字颜色改为金色强调色。
- 实现方式：`hero-term-text` 从继承色改为 `var(--amber-warm, #c4893f)`。

## 四次修正（中文副标题两行文案）

- 根据用户补充要求，将 Hero 中文副标题替换为两行：
  - 第一行：`为地球留下行动，为自己积累价值，为未来建立信任`
  - 第二行：`你为未来做过的事，都值得被看见`
- 两行共用同一 `hero-subtitle` 样式，保持相同文字大小、颜色与风格。
- 两行之间使用默认行间距，不额外增加异常间隔。

## 五次修正（Climate Passport 文案与提示）

- 根据用户补充要求，中文 Hero 描述文案更新为：
  - `Climate Passport 将你的学习、参与、证书与气候行动，转化为一份由你拥有、可验证、可分享的可信数字档案。让每一次努力被看见，让每一次行动成为未来的价值。`
- 其中 `Climate Passport` 文字改为与“气候时代”一致的金色强调。
- 为该 `Climate Passport` 添加 hover tips：
  - `在气候变化重塑世界的今天，每一次学习、参与和行动，都可能成为面向未来的重要能力与可信记录。Climate Passport 帮助你建立一份属于自己的可信数字档案。Climate Passport is an AI-driven digital identity infrastructure for the climate era.`

## 六次修正（中文主标题替换）

- 根据用户补充要求，将中文 Hero 主标题从“属于你的气候时代的可信档案”改为：
  - `为气候时代构建可信数字身份基础设施。`
- 其余行为保持不变：
  - `气候时代` 仍保留金色强调与 hover tips；
  - 布局比例、副标题、右侧自动轮播区域均不调整。

## 七次修正（主标题字号缩小 30%）

- 根据用户补充要求，对已替换后的中文主标题字号进行统一缩小 30%。
- 实现方式：仅调整 `proto-title-zh-single-line` 的 `clamp()` 参数（桌面 + 平板 + 手机三个断点）。
- 除字号外，其余样式保持不变。

## 八次修正（主标题下方两块文字缩小约 10%）

- 根据用户补充要求，将主标题下方两块文字统一缩小约 10%：
  - 两行副标题（`hero-subtitle`）
  - 描述段落（`hero-desc`）
- 调整结果：
  - `hero-subtitle`：`1.2rem -> 1.08rem`，移动端 `0.85rem -> 0.77rem`
  - `hero-desc`：`1.0625rem -> 0.96rem`，移动端 `0.9375rem -> 0.84rem`

## 九次修正（多语言主标题校验与对齐）

- 根据用户要求，校验并对齐非中文语言首页主标题翻译。
- 英文主标题定义更新为：
  - `Building trusted digital identity infrastructure for the climate era.`
- 同步修正法语/德语主标题，确保语义与英文定义一致：
  - FR: `Construire une infrastructure d'identite numerique de confiance pour l'ere climatique.`
  - DE: `Aufbau einer vertrauenswurdigen digitalen Identitatsinfrastruktur fur das Klima-Zeitalter.`
- 修改文件：`apps/passport-web/lib/site-content.ts`

## 十次修正（非中文标题样式与提示统一）

- 根据用户反馈，统一 `en/fr/de` 与中文主标题的视觉与交互行为：
  - 关键词保持金色强调（与“气候时代”一致）；
  - 关键词支持 hover tips；
  - 主标题字号策略改为共享统一规则（`proto-title-hero-unified`）。
- 关键词按语言映射：
  - EN: `climate era`
  - FR: `ere climatique`
  - DE: `Klima-Zeitalter`
- 非中文 tips 文案使用英文解释版本，保持语义一致。
- 修改文件：
  - `apps/passport-web/components/platform-screens.tsx`
  - `apps/passport-web/app/globals.css`

## 十一次修正（副标题与描述的多语言内容对齐）

- 根据用户反馈，`en/fr/de` 的副标题与下方描述文案未与中文语义对齐。
- 调整方式：在 `HomeScreen` 中为 `zh/en/fr/de` 显式定义对齐文案，不再让非中文回退到旧默认文案。
- 结果：
  - 四种语言的副标题均为两行同结构表达；
  - 四种语言的描述段落均与中文语义保持一致；
  - `Climate Passport` 金色强调与 hover tips 在四语保持一致。
- 修改文件：`apps/passport-web/components/platform-screens.tsx`

## 十二次修正（Climate Passport tips 按语言翻译）

- 根据用户反馈，`en/fr/de` 的 `Climate Passport` hover tips 未按语言翻译。
- 调整方式：在 `HomeScreen` 中新增 `climatePassportTipByLocale`，对 `zh/en/fr/de` 分别提供 tips 文案。
- 结果：`Climate Passport` tips 在四语页面均显示对应语言文本（保留结尾英文定义句）。
- 修改文件：`apps/passport-web/components/platform-screens.tsx`

## 十三次修正（Climate Passport 后空格统一）

- 根据用户补充要求，在 Hero 描述段中 `Climate Passport` 与后续正文之间统一增加 1 个空格。
- 该渲染路径对 `zh/en/fr/de` 复用，因此四语同步生效。
- 修改文件：`apps/passport-web/components/platform-screens.tsx`
