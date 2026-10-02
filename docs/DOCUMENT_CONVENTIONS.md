# docs/ 文档维护约定

日期：2026-09-21 · 性质：本目录自身的写作与核对规则 · 不改变任何产品、架构或隐私决策。
本文把 `docs/README.md` 的 Maintenance Rules 展开成可执行的口径；两者冲突时以 `docs/README.md` 为准。

---

## 1. 五层文档，不要混写

| 层 | 例子 | 规则 |
| --- | --- | --- |
| 权威层 | `CURRENT_PRODUCT_REQUIREMENTS.md`、`CURRENT_ARCHITECTURE_DECISIONS.md`、`CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md`、`PASSPORT_ID_AND_QR_SPEC.md`、`CHANNEL_SHELL_INTEGRATION_SPEC.md`、`CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md` | 产品/架构决策**只在这里**变更；新决策先改这一层 |
| 状态层 | `CURRENT_IMPLEMENTATION_STATUS.md`、`CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`、`docs/trackers/*` | 记录「现在做到哪」，随进度改期 |
| 溯源层 | `V21_CAPABILITY_TEST_TRACEABILITY.md` | 每个能力 → 证据 → 门禁，三列对齐 |
| 记录层 | `*_20260921.md`、`BUGFIX_*.md`、`OPEN_API_V1_zh.md`、`OPERATIONS_RECOVERY_HANDOVER.md` | 带日期的一次性记录，**落笔即冻结** |
| `docs/archive/` | 30 份历史件 | 保留历史，不是需求；除非权威层文档明确指回，否则不得据此实现 |

## 2. 命名与落位

- 全大写 `UPPER_SNAKE.md`；模块级 pending 清单进 `docs/trackers/`；机器可读规范进 `docs/openapi/`。
- 一次性审计、决策、交接记录带 `_YYYYMMDD` 后缀（顶层 198 份 `.md` 中 171 份已是这种形态）。
- 修复记录用 `BUGFIX_` 前缀（71 份）。
- 中文设计说明用 `_zh.md` 后缀；当前仅 `OPEN_API_V1_zh.md` 一份，新写作可沿用，但不必把既有英文标题文档改名。
- 新增文档要在 `docs/README.md` 的对应清单里登记一行，否则等于不存在。

## 3. 头部元数据：三种写法各有适用面

| 写法 | 用在 | 已用文件数（本次实测） |
| --- | --- | --- |
| `Last updated: YYYY-MM-DD` | 长期演进、会被反复改的文档 | 14 |
| `日期：YYYY-MM-DD · 状态：…` | 一次性记录/决策/审计 | 8 |
| `> 状态：…` 引用块 | 设计说明这类「正文很长、状态要显眼」的文档 | 1（`OPEN_API_V1_zh.md`） |

约定：改长期文档必须同时改 `Last updated:`；一次性记录**只增不改**，要更新认识就另立日期条目。

## 4. 历史条目不回填

历史日期的条目按当时口径原样保留。典型例：`/api/external/**` 已整体并入 `/api/v1/open`，但早期批次的报告
（`FUNCTIONAL_TEST_REPORT_20260921.md`、各 `BUGFIX_*`）里出现的旧路径**不改写**——那是当时的的事实。
新的状态由新日期条目记录（见 `OPEN_API_V1_zh.md` §11 第 2 条的说明）。相对日期（"上周"、"昨天"）一律写成绝对日期。

## 5. 证据三层，且必须可复跑

一个「已完成」声明按此顺序给证据，缺一层就写明缺哪层：

1. **源码级断言**：`tests/*.test.mjs`（`npm test`），断言实现形状。
2. **真实数据库接口矩阵**：`tests/api/*.test.ts`（`npm run test:api`，隔离库 `climatepassport_test`）。
3. **浏览器 e2e**：`tests/e2e/*.spec.ts`（`npm run test:e2e -- <spec>`，自行拉起 `127.0.0.1:3100`）。

不在这三层里的验证（手动 curl、读代码、外部服务）要写清是「实测」还是「推断」。测不到的直接写「未验证」，
不要为了文档好看而省略。

## 6. 数字落笔前重新跑、重新数

**任何测试数、文件数、迁移数都必须是本次实跑/本次重新 grep 的结果。** 这类数字被写错过：
`595/595` 实际已是 `603/603`；「空库 44 迁移」实际是 45；接口用例的跳过数会随测试库遗留状态摆动（6↔7），
摆动要在文档里说明原因而不是挑一个好看的值。子代理与压缩摘要给出的计数同样会过期，引用前自己复核一遍。

## 7. 环境状态要写「有意的未做」

迁移与部署状态必须显式声明，避免被读成遗漏：

- 本批改动**未提交、未推送、未部署**；只有用户明确要求时才 commit。
- 开发库刻意停在 `44/45`（`20260921120000_channel_client_key_lifecycle` 只应用到隔离测试库）——
  这是变更安全规则，不是忘记迁移。
- 测试一律走 `climatepassport_test` + `MAIL_TRANSPORT="test-outbox"`。

## 8. 交叉引用

- 用相对路径 markdown 链接（同一目录内直接写文件名），改标题要同步所有引用点。
- 涉及 `docs/openapi/v1.yaml` 与真实路由一致性的改动，跑 `node artifacts/check-openapi.mjs` 后再写文档结论。
- 设计说明只写契约与决策；具体某次交付的证据数字放状态层/溯源层，避免多处维护同一数字。

## 9. 本目录统计（2026-09-21 实跑）

顶层 `.md` 198 份；子目录 `archive/`（30）、`trackers/`（4）、`openapi/`（`v1.yaml`，1599 行）、`ui-prototypes/`。
重新计数：

```bash
ls docs/*.md | wc -l
ls docs/*.md | grep -cE '_20[0-9]{6}'
grep -rl '^Last updated:' --include='*.md' docs | wc -l
```
