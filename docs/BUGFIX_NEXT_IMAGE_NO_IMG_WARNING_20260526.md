# 需求解读
Next build 仍在提示 `@next/next/no-img-element`，主要来自首页轮播图、气候护照二维码图像和账户菜单头像。需要改成 `next/image`，减少构建警告并保持现有视觉效果。

# 修改方法
1. 将静态/半静态展示图像切换为 `next/image`。
2. 为每个图像补齐宽高或 `fill` 布局所需的容器约束。
3. 不改动内容结构与展示顺序，只替换渲染方式，保留原有样式。

# 修改内容
- 文件：[apps/passport-web/components/platform-screens.tsx](apps/passport-web/components/platform-screens.tsx)
  - 首页 hero 轮播图改为 `next/image`。
  - 气候护照二维码改为 `next/image`。
- 文件：[apps/passport-web/components/user-account-menu.tsx](apps/passport-web/components/user-account-menu.tsx)
  - 账户头像改为 `next/image`。
- 文件：[apps/passport-web/app/styles/features/home.css](apps/passport-web/app/styles/features/home.css)
  - 补充 `hero-media-image` 的尺寸与裁切样式，兼容 `next/image`。
- 结果：消除这批 `no-img-element` 构建警告，同时保持原有视觉布局。
