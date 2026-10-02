# 第二轮：Platform / 2026-10-01

本轮覆盖 v1 的 Programme/Earthshot 大标题取舍，同一个三页原型与 4340 预览，不新增设计方向或生产项目。

## 实际规范来源与 pin

已实际读取本地 `../my-standards/prompts/web_PLATFORM_AGENT_START.md` 及指定 README、AGENTS、Global Foundation、Platform DESIGN_SYSTEM、INTERACTION_SYSTEM、AI_BUILD_RULES、REFERENCE_REGISTRY。版本仓库 1.1.1，Web Platform v1.0；commit `8be9f7f980d42fbb1e9ec73efd5f7af61f22a5c8`。

Web 颜色/字体/布局/动态 tokens 实际写在上述 Markdown CSS 块中，此版本没有独立 Web tokens JSON。未误用 documents/WORD_TOKENS.json。Platform display 已含 17.5% 调整，本轮没有再套同一百分比。用户本轮明确要求更小字号和渐变，作为当前项目例外记录；不修改全局规范。

## 字号与层级（CSS px）

| 项目 | v1 1440 / 390 | v2 1440 / 390 |
|---|---|---|
| 首页主标题 | 72 / 40 | 43.2 / 32 |
| Passport 主标题 | 72 / 40 | 32.4 / 30 |
| 活动主标题 | 72 / 48 | 32.4 / 30 |
| 首页正文引导 | 20 / 18 | 18 / 16 |
| 首页说明段落 | 24 / 20 | 18 / 16 |
| 普通正文 | 16 / 16 | 16 / 16 |
| Passport 数字 | 48 / 36 | 32 / 28 |

标题 600，正文 400，元信息 12px；操作页 H2 24px、条目标题 20px。没有机械等比缩小正文和触控目标。按钮 48px、2px 圆角，替代粗大胶囊；主要操作保留明确标签。

## 渐变与动态

Platform 蓝/白/中性色占主导，CP 原 logo 不换色。首页白到 sky-soft/sky 的浅渐变；护照概念封面保留纸面 sand 材质与局部折光；个人身份与活动海报使用 deep-blue → teal，有对比度约束的渐变。半透明 sticky header 与细边界产生层次，普通列表不加悬浮阴影，不堆嵌套卡片。

首页入口只有一次 560/760ms 轻错层进入；页头通过一个 IntersectionObserver 在阈值处收紧并保持导航；行箭头 4px hover/focus，按钮色调 160ms，tabs/模态/表单反馈 240/420ms。无滚动劫持、持续漂浮或 parallax。键盘与触屏均能触发；reduced-motion 禁止 CSS 动画、transition、平滑滚动与 JS feedback animation。

可用性修复：tab roving tabindex + 左右/Home/End；凭证导航 #certs 真正选择凭证标签；模态标题 aria-labelledby；每个模态独立记录 opener；手机护照封面 aspect-ratio/min-width 导致的溢出已修复。

## 验证结果

本机 Chrome 实际检查三个页面的 1440/390/768 布局与截图。手机首页溢出修复后复看像素，封面右边界与正文共同落在20px gutter内。三页菜单/实际页间导航、Passport tabs/分享/编辑/证书、活动报名必选框和无提交反馈、收藏与日程 disclosure 经过操作；键盘提交与 Escape focus restoration 通过。

在真实 Chrome Rendering 面板启用 `prefers-reduced-motion: reduce`，三页文字和操作可见，菜单、标签、凭证、报名反馈仍工作；结束恢复 No emulation。控制台未发现原型 app.js 错误；看到既有 Chrome 扩展 mf.js 的 Params are not set，以及 CSP 拒绝 DevTools 自动请求 styles.css.map/appspecific metadata，未放宽 connect-src。

计算最弱白字渐变端点 white/teal 4.68:1，white/deep-blue 7.41:1，soft/background约7.22:1。按钮 hover 改为 teal，避免 white/blue 4.35:1；正文文字链接 hover 保持 deep-blue。主正文至少16px；focus3px；关键目标至少44px。

这是原型浏览器检查，非生产完整业务回归或无障碍认证。

## 20项 QA（范围内，18/20）

| Shared | 分数 |
|---|---|
| 1 对齐 | 1 |
| 2 无任意颜色：仅 Platform palette/透明派生，渐变当前用户授权 | 1 |
| 3 字号：按用户授权的项目紧凑 scale，正文/元信息底线保留 | 1 |
| 4 spacing tokens | 1 |
| 5 独立移动布局 | 1 |
| 6 无嵌套卡片：封面内部为无边框内容排版 | 1 |
| 7 keyboard/focus | 1 |
| 8 reduced-motion | 1 |
| 9 完整授权纪实影像 | 0：暂无素材，保留明确原型示意 |
| 10 密度交替 | 1 |

| Platform | 分数 |
|---|---|
| 1 stable header | 1 |
| 2 priorities before archive | 1 |
| 3 metrics legible/scoped | 1：仅明确合成用户指标，不假造首页影响力 |
| 4 framing before stories | 1：未提供人文故事，不虚构 |
| 5 event facts structured | 1 |
| 6 news/report distinction | 1：本三页无新闻/报告档案，不添加伪内容 |
| 7 blue/neutral dominant | 1 |
| 8 restrained motion | 1 |
| 9 full institutional footer utilities | 0：完整法律/语言/联系生产导航未移植 |
| 10 multilingual expansion capacity | 1：可换行结构，未实现翻译/语言切换 |

例外：用户明确授权渐变及紧凑标题；保留明确示意而非授权纪实照片；三页审稿 footer 简化；合成资料与设计标注仅在审稿页。

## 安全、版本与边界

v1 原型完整安全快照和 SHA256 manifest：`/tmp/cp-v1-20261001/prototype`、`/tmp/cp-v1-20261001/manifest.json`。本轮 fresh hash baseline：`/tmp/cp-v2-fresh-files.json`。本轮仅写本 design-review 目录；检测到 schema、contracts、consents 三个文件同期变化，属于并发工作，本轮未读写其内容，也未覆盖或回滚。不沿用旧1109 hash来覆盖他人改动。

全部原有三页文案/演示信息保留；活动标题合并视觉换行、凭证链接修正、菜单补凭证入口。没有 DB/API/auth/邮件/SSO、生产路由、密钥、Git HEAD/index、push/deploy 变更。分享仍无真实身份链接/二维码；表单不保存、不报名；收藏仅本页内存；证书不签发不下载；任务、签到、提交、社区、排行仅内容映射，未接入真实业务。

原三个 Library 身份已替换到版本1，没有新建重复文件：

| 页 | Library ID | version |
|---|---|---|
| 首页 | libfile_73152dc6a3408191bea33deaffae2688 | 1 |
| Passport | libfile_ceaecc894d408191bea660b28a79cbc0 | 1 |
| 活动详情 | libfile_84e1e207754c8191b9b14c26ee850c33 | 1 |

没有再次尝试 Superdesign 外部分享。预览 PID25622，loopback4340，非系统常驻；停止前确认端口PID后 `kill 25622`。
