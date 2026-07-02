# Non-Home Typography Audit Checklist (2026-05-30)

## 需求解读

- 用户要求：除首页外，所有页面与模块的字体、字号应统一由全局体系管理。
- 审计目标：建立可复用巡检清单，持续发现并消除非首页硬编码字体/字号回归。

## 修改方法

1. 扫描范围：`apps/passport-web` 下非首页 TSX 与 CSS。
2. 扫描规则：
   - CSS 检查 `font-size: <number>`（排除 `home.css`）。
   - TSX 检查 `fontSize` 数字或数字字符串字面量（排除首页视觉文件）。
3. 迁移策略：
   - 优先映射到 `--cp-text-*`、`--cp-admin-text-*`。
   - 历史特殊值统一映射到 `typography-system.css` 中的 `--cp-fs-*` 与 rem 映射变量。
4. 构建验证：执行 `npm run build --workspace passport-web`。

## 修改内容

### 本轮巡检结果

- CSS 非首页硬编码字号：已清零（按当前规则扫描）。
- TSX 非首页硬编码字号：已清零（按当前规则扫描）。
- 构建验证：通过。

### 页面抽样验收（浏览器实测）

- 抽样页面（zh）：`/zh/admin`、`/zh/admin/activities`、`/zh/activities`、`/zh/dashboard/my-activities`
- 抽样页面（en）：`/en/admin`、`/en/admin/activities`、`/en/activities`、`/en/dashboard/my-activities`
- 实测结果：
   - `body` 统一为 sans 全局字体栈（Inter + CJK fallback），未发现页面级字体族分裂。
   - `body` 基线字号统一为 `15px`。
   - 页面内采样文本元素未发现非预期 monospace 漂移。
   - 采样字号分布集中于全局映射尺度（如 10/11/12/13/14/15/16/17/20/22 等）与少量业务展示大字号 token 对应值。
- 说明：页面切换过程中出现个别 `ERR_ABORTED` 属于路由快速切换导致的请求中断，不影响最终渲染与样式校验结论。

### 例外说明

- 首页视觉域（`home.css`）不纳入本巡检。
- 海报/打印相关构图元素允许使用全局 token 中的大字号映射（如 `--cp-fs-64`、`--cp-fs-72`），不得直接新增裸字面量。

### 持续执行建议

- 后续每次涉及 UI 改动时，按本清单重复执行巡检。
- 若出现新字号需求，先扩展 `typography-system.css` token，再使用于业务模块。
