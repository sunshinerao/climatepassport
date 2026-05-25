# BUGFIX_CERTIFICATE_ISSUE_DRAFT_PRESERVE_ONLY_ON_LOCALE_SWITCH_20260525

## 需求解读
- 证书签发编辑区在切换语言时应保留当前已填写的数据，避免多语言切换导致输入内容丢失。
- 但在确认签发、取消编辑、离开功能后重新进入等明确结束当前编辑流程的场景下，编辑区数据应被清空，不能继续自动回填旧草稿。

## 修改方法
- 将证书签发草稿的保留范围从“所有页面重进”收缩为“仅语言切换”。
- 在语言切换器中显式标记本次导航为语言切换；签发页卸载时仅对这种情况保留草稿，其他离开场景统一清除草稿。
- 为单个签发表单新增统一重置函数，在确认签发成功和取消编辑时同步清空表单状态与持久化草稿。

## 修改内容
- 修改 `apps/passport-web/components/certificate-admin-prototype.tsx`：
  - 新增语言切换保留标记识别逻辑。
  - 新增 `resetSingleIssueForm(...)` 和 `clearIssueDraftStorage()`。
  - 在页面卸载时，只有语言切换才保留草稿，普通离开会清空草稿。
  - 在确认签发成功后清空单个签发编辑区数据，并保留成功提示。
  - 在取消编辑时清空单个签发编辑区数据与草稿。
- 修改 `apps/passport-web/components/locale-switcher.tsx`：
  - 点击语言选项时写入“本次为语言切换”的保留标记，供证书签发页识别。
