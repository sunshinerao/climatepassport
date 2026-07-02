# Activity 表单输入失焦修复（2026-05-30）

## 需求解读

- 问题：在“新增 Activity”页面输入标题时，输入一个字符后输入焦点丢失。
- 目标：定位根因并修复，确保标题输入稳定；同时检查同页面其他 input/textarea 是否存在相同问题。

## 修改方法

1. 先在浏览器复现 `/zh/admin/activities/new` 的标题输入失焦现象。
2. 代码定位到 `admin-activity-form-client.tsx`，检查会导致重渲染与节点重建的结构。
3. 将定义在主组件函数内部的 React 子组件（Section/Row/Group/Toggle）提升到模块顶层，避免每次 state 变化时组件类型引用变化导致子树重挂载。
4. 回归验证：
   - 标题输入框真实键盘输入后焦点保持。
   - 抽查其他 input/textarea 多个字段，确认焦点保持。

## 修改内容

- 修改文件：
  - `apps/passport-web/components/admin-activity-form-client.tsx`
- 关键调整：
  - 将 `Section`、`Row`、`Group`、`Toggle` 从 `AdminActivityFormClient` 内部移动到文件顶层。
  - `Group` 新增 `optionalText` 入参，保持“可选/optional”文案能力，不依赖组件内局部函数。
  - 在部分 `Group optional` 调用处补充 `optionalText`，保证中英文显示一致。
- 验证结果：
  - 标题输入：焦点保持正常。
  - 其他输入抽查（英文标题、摘要/描述类字段）：焦点保持正常。
  - 结论：本问题根因为组件身份不稳定引发的重挂载，修复后同页面输入控件未复现同类失焦问题。
