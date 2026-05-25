# BUGFIX_HOMEPAGE_WHITESPACE_REBALANCE_20260525

## 需求解读

- 用户确认采用“混合方案”处理首页两处留白：
  - Hero 上方留白收紧（但保留开场呼吸感）。
  - 第五部分（Features）与 Footer 之间留白收紧。
- 关键约束：不能影响其他页面当前正常视觉效果。

## 修改方法

- 仅修改首页作用域样式（`.proto-home` 与 `.page.page-home`），避免跨页影响。
- 采用分断点收敛策略：桌面、平板、手机分别设置更合理的留白值。
- 用更高特异性 `.page.page-home` 覆盖通用 `.page`，确保首页主容器 padding 真正归零，而非被后续全局规则回写。
- 修改后执行：
  - CSS 错误检查
  - 自动化测试
  - 首页与非首页（about）行为对比验证

## 修改内容

- 修改文件：`apps/passport-web/app/styles/features/home.css`
  - 首页主容器隔离：
    - `.page-home` -> `.page.page-home`（确保覆盖全局 `.page`）
  - Hero 留白收紧：
    - 桌面：`padding: 68px 32px 96px`
    - 平板（<=980）：`padding: 56px 24px 84px`
    - 手机（<=640）：`padding: 40px 16px 56px`
  - 第五部分（Features）底部留白收紧：
    - 桌面：`padding: 50px 32px 30px`
    - 平板（<=980）：`padding-bottom: 24px`
    - 手机（<=640）：`padding-bottom: 18px`

- 验证结果：
  - 首页：`main.page.page-home` 计算值为 `padding-top: 0px`, `padding-bottom: 0px`。
  - 首页：`features` 到 `footer` 间隙为 `0px`（相邻区块无额外外部留白）。
  - 非首页（`/en/about`）：`main.page` 仍为 `padding-top: 64px`, `padding-bottom: 96px`，说明其他页面视觉基线未受影响。
  - `get_errors`：`home.css` 无错误。
  - `npm test`：`38 passed / 0 failed`。
