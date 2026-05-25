# BUGFIX: 首页第三部分标题区上下居中与字体统一（2026-05-25）

## 需求解读

- 用户要求第三部分标题区三行文案采用上下居中排列：
  - 使用方式
  - 三步开启你的Climate Passport
  - 几分钟内开始，成为有意义的行动的一部分
- 要求“"三步开启你的Climate Passport"”标题字号与 Hero 区标题字号保持一致。
- 要求其中“Climate Passport”字体与页面其他英文字体保持一致。

## 修改方法

- 在首页组件中调整第三部分标题结构，给 `Climate Passport` 增加独立 span 类名，便于只控制该英文短语字体。
- 在 How It Works 的 CSS 区块中将 section header 改为 column 布局并启用居中对齐，确保三行内容上下居中。
- 将 How It Works 的标题字号改为与 Hero 使用的统一尺寸值（同一组 clamp 数值）。

## 修改内容

- 修改文件：`apps/passport-web/components/platform-screens.tsx`
  - How It Works 标题改为分段渲染，新增 `section-title-en` 用于 `Climate Passport`。
  - 中文副标题改为：`几分钟内开始，成为有意义的行动的一部分`。
  - 中文标题改为：`三步开启你的Climate Passport`（去除“你的”和英文之间的空格）。

- 修改文件：`apps/passport-web/app/globals.css`
  - `.proto-home .how-it-works .section-header` 新增垂直布局与居中对齐：`display: flex; flex-direction: column; align-items: center; justify-content: center;`。
  - `.proto-home .how-it-works .section-title` 字号改为 `clamp(0.84rem, 2.94vw, 2.35rem)`，与 Hero 标题统一。
  - 新增 `.proto-home .how-it-works .section-title-en`，为 `Climate Passport` 指定页面通用英文字体栈（Inter / Noto Sans / Source Han Sans 等）。
