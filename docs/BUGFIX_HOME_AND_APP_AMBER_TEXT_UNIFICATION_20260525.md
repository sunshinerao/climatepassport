# BUGFIX_HOME_AND_APP_AMBER_TEXT_UNIFICATION_20260525

## 需求解读

首页里 Hero、统计数字、How It Works、footer 等位置的金色文本观感不一致，用户要求把首页金色严格统一，并扩展到整个程序，让可见的金色文本保持同一主色。

## 修改方法

先核对实际使用的颜色变量，确认不一致主要来自少数可见文本还在使用较浅的 `amber-soft`。然后只把这些“文本类金色”切回与 Hero 一致的 `amber-warm`，保留按钮、渐变和装饰性背景的现有层次，不做大范围重设。

## 修改内容

- 修改文件：`apps/passport-web/app/globals.css`
  - 将首页统计数字 `.proto-home .stat-value` 从 `amber-soft` 改为 `amber-warm`。
  - 将 legacy 统计区 `.proto-stats-strip strong` 从 `amber-soft` 改为 `amber-warm`。
  - 将 footer 区块标题 `.footer-col h4` 从 `amber-soft` 改为 `amber-warm`。

- 结果：Hero、首页统计数字、footer 区块标题等可见金色文本统一为同一个主金色值，避免首页与全站的金色观感分裂。