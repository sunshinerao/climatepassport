# CHANGE_CLIMATE_PASSPORT_HERO_TAGS_QR_OPTIMIZATION_20260526

## 需求解读

用户要求在 Climate Passport 页面顶部绿色护照区域进行两项视觉与信息增强：

1. 左侧绿色区域增加三类标签信息：
- 签发日期
- 已经解锁成就数量
- 获得徽章数量

2. 右侧二维码区域参考给定截图进行优化，提升信息层级与识别性。

## 修改方法

1. 在 `ClimatePassportScreen` 中复用现有数据字段，避免新增后端接口：
- 签发日期使用 `account.issuedAt`
- 已解锁成就使用 `account.achievements`
- 获得徽章数量使用 `badgeWall` 中 `unlocked` 计数

2. 重构右侧二维码区域结构：
- 增加“身份二维码”眉标
- 增加“护照核验码 + 实际编码”信息行
- 增加“全场通用”状态胶囊
- 增加二维码容器与说明文案

3. 在 dashboard 样式文件中新增对应样式并补齐移动端适配。

## 修改内容

1. 组件改动
- 文件：`apps/passport-web/components/platform-screens.tsx`
- 内容：
  - 新增 `unlockedBadgesCount` 计算。
  - 左侧 ID 下方新增 `passport-dashboard-hero-tags` 三枚标签：
    - 签发日期
    - 已解锁成就
    - 获得徽章
  - 右侧二维码区域由单一“二维码 + 扫码文字”改为：
    - 眉标
    - 核验码信息行
    - 状态标签
    - 二维码画布区
    - 底部说明文案

2. 样式改动
- 文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
- 内容：
  - 新增左侧标签组样式：`passport-dashboard-hero-tags`、`passport-dashboard-hero-tag`。
  - 重做二维码区样式：`passport-dashboard-hero-qr-*` 相关结构样式。
  - 增加字体统一规则与移动端断点适配（二维码卡片宽度、标题排版、标签居中等）。

3. 验证
- 已完成静态代码修改并保持现有页面信息架构不变。
- 建议通过 `npm run build` 和页面实测继续确认最终视觉效果。