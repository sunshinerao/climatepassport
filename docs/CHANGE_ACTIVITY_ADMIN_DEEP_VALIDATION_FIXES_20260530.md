# 变更文档：Activity Admin Deep Validation Fixes

**日期**：2026-05-30  
**涉及模块**：活动后台（Activity Admin EVENT 控制台）

## 需求解读

在完成活动后台控制台改造后，进行深度写操作验证时暴露出两个关键阻断：

- 同页议程新增弹层无法交互（按钮可见但表单不可用）
- 机构关联链路缺少可快速补数的后台入口，导致在空库/样本不足时无法完成“机构添加+删除”的真实写操作闭环

本次目标是在不改动活动核心数据模型和既有业务链路的前提下，修复上述阻断并完成一次可落地的深度回归路径。

## 修改方法

1. 将议程同页弹层从复用全局 `.proto-admin-overlay` 改为模块私有类名，避免与 admin 侧栏移动端遮罩样式冲突。
2. 在活动后台样式文件中新增议程弹层样式，保证弹层可见、可滚动、可输入。
3. 新增最小化 admin institutions API（列表 + 创建），仅用于后台受控环境补齐机构主数据，支持机构关联写操作验证。
4. 用真实登录态执行回归：新增活动、编辑活动、状态流转、嘉宾增删、验证员增删、议程新增编辑删除、机构关联增删。

## 修改内容

### 1. 修复同页议程弹层不可交互

- `apps/passport-web/components/admin-activity-agenda-client.tsx`
  - 把议程弹层容器从 `proto-admin-overlay` 改为 `activity-agenda-modal-overlay`
  - 弹层面板追加 `activity-agenda-modal` 类名

- `apps/passport-web/app/styles/features/activity-admin-console.css`
  - 新增 `activity-agenda-modal-overlay` 样式（fixed/inset/background/z-index）
  - 新增 `activity-agenda-modal` 样式（最大高度和滚动）

### 2. 新增后台机构最小写入 API

- `apps/passport-web/app/api/admin/institutions/route.ts`（新建）
  - `GET`：返回活动后台可用机构列表（active）
  - `POST`：创建机构（ADMIN / EVENT_MANAGER 可用）
  - 对 slug 做标准化并校验唯一性

### 3. 深度验证执行结果（登录态真实写操作）

- Activity 新建：通过
- Activity 编辑：通过（副标题更新已落库）
- 状态流转：通过（发布/进行中/完成/归档）
- 嘉宾写操作：通过（新增 + 移除）
- 验证员写操作：通过（分配 + 移除）
- 议程写操作：通过（同页新增可用；并完成新增/编辑/删除闭环）
- 机构写操作：通过（先创建机构主数据，再完成关联 + 移除）
