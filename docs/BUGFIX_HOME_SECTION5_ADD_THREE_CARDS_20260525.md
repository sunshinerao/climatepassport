# BUGFIX: 第五部分按截图新增三张卡片并更新文案（2026-05-25）

## 需求解读

- 用户要求针对第五部分（Features）按截图进行改动。
- 约束：只增加卡片并更新内容，不改其他任何内容。

## 修改方法

- 仅修改首页组件中的第五部分卡片列表。
- 在原有三张卡片基础上新增三张卡片，使该部分与截图一致为两行共六张卡片。
- 不修改第五部分以外的区块、样式规则或布局参数。

## 修改内容

- 修改文件：`apps/passport-web/components/platform-screens.tsx`
  - 更新原三张卡片内容：
    - 数字身份 / Digital Identity
    - 活动网络 / Activity Network
    - 可信证书 / Trusted Certificates
  - 新增三张卡片：
    - 学习体验 / Learning Experience
    - 智能签到 / Smart Check-in
    - 影响力追踪 / Impact Tracking
  - 每张新增卡片补充对应图标与中英文文案。
