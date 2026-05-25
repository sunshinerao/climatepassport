# BUGFIX: Footer 区块文案与结构更新（2026-05-25）

## 需求解读

- 用户要求更新 footer section：
  - 导航菜单改为：首页、Climate Passport、证书、合作、关于我们。
  - 信息改为“法律与支持”，菜单改为：隐私政策、服务条款、常见问题、联系我们。
  - 联系改为“保持联系”，内容改为：contact@climatepass.org，且“中国上海”保持不变。
  - 删除底部左侧免责声明文字与底部服务条款/隐私政策链接。
  - 底部版权文案改为：`© 2026 Climate Passport. 保留所有权利。面向气候时代的可信数字身份基础设施。`

## 修改方法

- 仅修改 `site-shell.tsx` 中 footer 的 JSX 结构与文本。
- 保持 footer 的视觉样式不变，不修改其它页面或组件。
- 对“合作”菜单使用现有的 `contact` 页面，避免产生死链。

## 修改内容

- 修改文件：`apps/passport-web/components/site-shell.tsx`
  - 导航列更新为：首页 / Climate Passport / 证书 / 合作 / 关于我们。
  - 信息列标题更新为：法律与支持。
  - 信息列内容更新为：隐私政策 / 服务条款 / 常见问题 / 联系我们。
  - 联系列标题更新为：保持联系。
  - 联系邮箱更新为：`contact@climatepass.org`。
  - 底部免责声明与底部法律链接移除，仅保留单行版权文案。
