# FEATURE_STYLE_SPLIT_SHARED_FOOTER_20260525

## 需求解读

- 继续执行后续样式拆分，将全局文件中仍然较大的 Footer 样式段下沉到 shared 层。
- 目标是让 `globals.css` 聚焦基础层能力，避免承载完整 Footer 视觉实现。
- 保持样式行为不变，仅做归属调整。

## 修改方法

- 按连续区段整段提取 `.site-footer` 到 legacy footer 规则，迁移到 shared 样式文件。
- 在 `globals.css` 导入 shared footer 文件，确保加载顺序稳定。
- 从 `globals.css` 删除对应源区段，保留非 footer 的通用辅助类。
- 执行错误检查与测试确认无回归。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/shared/footer.css`
  - 承载 Footer 主样式、装饰层、结构层、底部 legal 栏，以及 legacy footer fallback 规则。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/shared/footer.css";`
  - 删除原 Footer 区块（`.site-footer` 到 `.footer-bottom`）。

- 校验结果：
  - `get_errors`：`globals.css` 与 `footer.css` 均无错误。
  - 选择器检查：`globals.css` 中不再包含 `.site-footer` 与 `.footer-*` 主样式段（仅保留 `.footer-note` 通用说明文本样式）。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
