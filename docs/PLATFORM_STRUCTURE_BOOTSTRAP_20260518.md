# Climate Passport 结构启动记录

## 需求解读

- 需要继续完成新仓库的第一步建设，不只是有一个空仓库，而是要有明确的工程结构和架构文档。
- 迁移原则必须明确记录：当前 SHCW 仓库里成熟的用户管理、Climate Passport、验码等功能和 UI 是被认可的，迁移时应优先保留，而不是默认重做。
- 新仓库需要具备后续持续开发的基础目录和 workspace 结构，方便后面逐步承接 `climatepass.org` 的平台开发。

## 修改方法

- 为新仓库补充 workspace 根配置和 TypeScript 基础配置。
- 预创建 `apps` 与 `packages` 下的核心目录，并用 README 占位定义职责。
- 新增平台架构文档，明确平台边界、交付模式、迁移原则与首阶段实施顺序。
- 更新仓库说明和平台 tracker，把“保留成熟功能与 UI 迁移”固化成正式要求。

## 修改内容

- 更新 `README.md`，加入迁移保留原则和 bootstrapped workspace 说明。
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`，补入架构完成状态和 UI 保留相关待办。
- 新增 `package.json` 作为 workspace 根配置。
- 新增 `tsconfig.base.json` 作为共享 TypeScript 基线。
- 新增 `apps/passport-web/README.md`。
- 新增 `packages/passport-contracts/README.md`。
- 新增 `packages/passport-ui-flows/README.md`。
- 新增 `packages/passport-sdk/README.md`。
- 新增 `docs/PLATFORM_ARCHITECTURE_20260518.md`。
- 新增 `docs/PLATFORM_STRUCTURE_BOOTSTRAP_20260518.md`。