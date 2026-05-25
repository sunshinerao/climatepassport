# BUGFIX: 语言切换器中文与英文顺序对换（2026-05-25）

## 需求解读

- 用户要求语言切换器中中文和英文位置对换。
- 其他语言顺序保持不变。

## 修改方法

- 在语言选项数组中仅调整 `zh` 与 `en` 的排列顺序。
- 为避免不同页面出现不一致，同步调整主站与夏校申请页的语言切换器。

## 修改内容

- 修改文件：`apps/passport-web/components/locale-switcher.tsx`
  - `LOCALE_OPTIONS` 顺序由 `en, zh, fr, de` 调整为 `zh, en, fr, de`。
- 修改文件：`apps/passport-web/components/summer-school-locale-switcher.tsx`
  - `OPTIONS` 顺序由 `en, zh` 调整为 `zh, en`。
