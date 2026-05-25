# BUGFIX_CERTIFICATE_RECORDS_PREVIEW_PRINT_LABEL_20260525

## 需求解读
- 证书记录列表中的操作按钮文案需要从“下载（预览/打印）”调整为“预览/打印”。
- 该改动仅涉及文案表达，不应改变原有按钮行为（仍然打开可预览/打印内容）。

## 修改方法
- 仅修改证书记录操作区对应按钮的中英文显示文案。
- 保持按钮绑定的现有处理函数不变，确保行为无回归。

## 修改内容
- 修改 `apps/passport-web/components/certificate-admin-prototype.tsx`：
  - 将 `t(locale, "下载（预览/打印）", "Download (Preview/Print)")`
  - 调整为 `t(locale, "预览/打印", "Preview/Print")`。
