# BUGFIX: 首页第三部分 How It Works 版式与文案对齐（2026-05-25）

## 需求解读

- 用户要求对首页第三部分（Hero 下方的 How It Works 区块）进行改动。
- 目标是参考截图中的内容与版式，对标题、三步卡片文案和视觉样式进行对齐。

## 修改方法

- 在页面组件中直接调整 How It Works 的标题与三步文案。
- 在全局样式中仅对 `.proto-home .how-it-works` 及其下属元素进行定向改造，避免影响其它区块。

## 修改内容

- 修改文件：`apps/passport-web/components/platform-screens.tsx`
  - 区块标题改为：
    - 中文：`三步开启你的 Climate Passport`
    - 英文：`Three Steps to Launch Your Climate Passport`
  - 三步文案改为与截图语义一致（Create Your Profile / Join, Participate & Learn / Earn & Share）。

- 修改文件：`apps/passport-web/app/globals.css`
  - How It Works 背景改为更接近截图的浅灰底色。
  - 提升该区块标题尺寸并放大标题容器宽度。
  - 调整卡片间距、卡片内边距、卡片底色与边框阴影。
  - 调整步骤数字圆形大小与数字字号。
  - 调整步骤标题与正文字号和行高，使整体版式更贴近截图。
