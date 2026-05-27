# CHANGE_SYSTEM_SETTINGS_LOGO_REFRESH_FIX_20260527

## 需求解读

用户反馈在系统管理页上传 Logo 并保存后，刷新页面看起来没有生效。

该问题属于品牌配置可用性问题，核心要求是：

1. 上传后的 Logo 必须可靠落库。
2. 保存后页面品牌展示（尤其 Header）要立即反映最新配置。
3. 上传读取过程与提交过程不能存在竞态，避免“提交时图片还没读完”。

## 修改方法

1. 在系统管理前端增加图片读取中的状态控制。
   - 图片读取未完成时禁止提交，避免提交 payload 时 logo 字段仍为空。
2. 保存成功后触发 `router.refresh()`。
   - 强制刷新当前路由数据，确保站点壳（Header/Footer）读取到最新品牌配置。
3. 增强 API 响应解析兼容。
   - 对非 JSON 错误响应做文本兜底，避免错误提示被吞掉。

## 修改内容

1. 更新文件：`apps/passport-web/components/admin-system-settings-client.tsx`
- 新增 `useRouter`，保存成功后执行 `router.refresh()`。
- 新增 `pendingImageReads` 状态：
  - `handleImagePick` 开始读取时加一，结束时减一。
  - `pendingImageReads > 0` 时禁止提交并提示“图片仍在处理中”。
- 保存接口响应解析增强：
  - 按 `content-type` 判断是否 JSON。
  - 非 JSON 且失败时读取文本错误并展示。
- 提交按钮禁用条件由 `isSaving` 扩展为 `isSaving || pendingImageReads > 0`。

2. 预期效果
- 上传 Logo 后，只有在图片读取完成后才允许保存。
- 保存成功后，Header/Footer 品牌展示可在当前页刷新中及时显示新 Logo。
- 异常响应会被明确展示，不再“看似保存但无变化”。
