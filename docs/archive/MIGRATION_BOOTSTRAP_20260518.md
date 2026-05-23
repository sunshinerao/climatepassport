# Climate Passport 仓库启动记录

## 需求解读

- 需要立即建立一个独立的 Climate Passport 仓库，用于承载未来的 `climatepass.org` 独立平台。
- 新仓库不能只是空目录，还要保留当前上海气候周系统的上下文、边界、迁移逻辑与接手信息，避免后续开发“断档”。
- 现有数据必须保留，因此新仓库要以当前 SHCW 仓库和数据库为迁移来源，而不是另起一套无上下文的新系统。

## 修改方法

- 在当前工作区下新建 `climate-passport` 独立目录，并初始化为新的本地 git 仓库。
- 在新仓库内先放入上下文承接文档、迁移说明与待办追踪器，而不是直接开始写业务代码。
- 通过 `README` 明确新旧仓库关系、系统所有权迁移方向与建议的目标结构。

## 修改内容

- 创建新的独立仓库目录：`climate-passport/`
- 初始化独立 git 仓库：`climate-passport/.git`
- 新增仓库说明文件：`README.md`
- 新增上下文承接文档：`docs/CONTEXT_CONTINUITY_20260518.md`
- 新增启动说明文档：`docs/MIGRATION_BOOTSTRAP_20260518.md`
- 新增平台待办追踪器：`docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
- 新增基础忽略文件：`.gitignore`
