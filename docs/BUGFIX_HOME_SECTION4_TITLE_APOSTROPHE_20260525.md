# BUGFIX_HOME_SECTION4_TITLE_APOSTROPHE_20260525

## 需求解读

第四部分标题当前显示成了 `Discover What&apos;s Next`，用户指出中间多了实体字符样式的撇号，应该显示为正常英文标题。

## 修改方法

直接修正第四部分标题的英文文本字面量，保留中文标题和其余布局不变，不触碰卡片、样式或间距。

## 修改内容

- 修改文件：`apps/passport-web/components/platform-screens.tsx`
  - 将 `Discover What&apos;s Next` 改为 `Discover What's Next`。

- 结果：第四部分标题恢复为正常英文显示，不再出现字面量 `&apos;`。