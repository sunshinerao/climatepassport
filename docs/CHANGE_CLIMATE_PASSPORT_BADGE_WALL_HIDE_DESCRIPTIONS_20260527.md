# CHANGE_CLIMATE_PASSPORT_BADGE_WALL_HIDE_DESCRIPTIONS_20260527

## 需求解读

用户要求在 Climate Passport 页面中的“徽章墙”卡片区域，不显示每个徽章下方的说明文字。

说明文字应仅在点击进入独立“徽章墙”页面后展示。

## 修改方法

1. 仅调整 Climate Passport 页面的徽章卡片渲染内容。
2. 保留“徽章墙”标题链接跳转逻辑不变。
3. 不改独立徽章墙页面的数据与展示，确保说明文字仍在该页面可见。

## 修改内容

1. 组件文件修改
- 文件：`apps/passport-web/components/platform-screens.tsx`
- 位置：`ClimatePassportScreen` -> 右侧 `徽章墙` 卡片渲染
- 变更：
  - 删除每个徽章卡片中的说明文字节点：
    - `item.description || item.verificationGrade`

2. 影响范围
- 仅影响 Climate Passport 页面内嵌徽章墙卡片。
- 独立徽章墙页面保持原有说明文字展示。