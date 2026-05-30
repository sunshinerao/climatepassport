# 变更文档：Activity Event Admin Console Alignment

**日期**：2026-05-29  
**涉及模块**：活动模块后台（Activity Event Admin）

## 需求解读

本次改造目标不是调整 Climate Passport 的活动数据结构，也不是重写现有活动业务 API，而是在保持现有 `activities` 体系、EVENT 类型逻辑、议程 / 嘉宾 / 验证员 / 报名审核等既有能力不变的前提下，把后台界面组织方式向 `my-app` 的活动管理后台对齐。

核心诉求包括：

- 活动列表从轻量表格升级为卡片化后台视图
- 活动详情从“导航中转页”升级为“单页直达操作控制台”
- 同页暴露活动运营常用动作，包括状态流转、议程、嘉宾、验证员、机构关联、海报与运营入口
- 保持原有 API、Prisma 模型、活动业务规则不变，只重组前端编排与呈现

## 修改方法

1. 先扩充活动详情页的服务端取数契约，把 EVENT 控制台需要的关系数据一次取齐，包括议程、嘉宾链接、可选嘉宾、验证员、可分配验证员、机构关联、可选机构和活动 detail 配置。
2. 在前端详情页复用现有的 `AdminActivityAgendaClient`、`AdminActivitySpeakersClient`、`AdminActivityVerifiersClient`，避免改动原有 CRUD 逻辑，只改变这些能力出现的位置和容器样式。
3. 新增一个轻量的 `AdminActivityInstitutionsClient`，直接对接已有 `/api/activities/[id]/institutions` 接口，补上机构关联的同页操作入口。
4. 为活动列表和详情控制台新增独立样式文件 `activity-admin-console.css`，统一卡片、统计区、操作块、空状态和响应式布局。

## 修改内容

### 1. 活动详情页升级为单页控制台

- `apps/passport-web/app/[locale]/admin/activities/[id]/page.tsx`
  - 扩展服务端查询
  - 追加 `activityDetail`、`agendaItems`、`speakerLinks`、`allSpeakers`、`verifiers`、`availableVerifiers`、`institutions`、`availableInstitutions`
  - 把这些数据统一传入详情客户端组件，支撑同页操作

- `apps/passport-web/components/admin-activity-detail-client.tsx`
  - 新增控制台头部 Hero 区
  - 新增统计卡片、基础信息 / 时间地点 / 报名规则三组面板
  - 新增快捷运营入口卡片区
  - 对 EVENT 类型内嵌：
    - 议程管理
    - 嘉宾管理
    - 验证员分配
    - 机构关联
  - 保留原有状态流转接口 `/api/activities/[id]/status`
  - 补充海报相关直达入口，并复用 `ActivityPosterButtons`

### 2. 活动列表升级为卡片化后台

- `apps/passport-web/components/admin-activities-client.tsx`
  - 将原表格列表改为卡片化列表
  - 增加顶部运营摘要区与统计卡片
  - 保留类型 Tab 和搜索
  - 每张卡片提供：
    - 状态 / 精选 / 置顶标签
    - 时间 / 地点 / 层级信息
    - 申请 / 参与 / 容量统计
    - 控制台、编辑、审核入口
    - 列表内状态快捷流转（发布 / 开始 / 完成 / 归档）

### 3. 新增机构关联同页面板

- `apps/passport-web/components/admin-activity-institutions-client.tsx`
  - 新增活动机构关联客户端组件
  - 复用已有 `/api/activities/[id]/institutions` GET / POST / DELETE
  - 支持：
    - 从机构库选择机构
    - 配置中英文角色说明
    - 查看当前已关联机构
    - 删除机构关联

### 4. 样式拆分与接入

- `apps/passport-web/app/styles/features/activity-admin-console.css`
  - 新增活动后台专用样式
  - 覆盖列表 Hero、详情 Hero、统计卡、快捷入口、同页表单与机构卡片样式
  - 提供桌面 / 平板 / 移动端响应式规则

- `apps/passport-web/app/globals.css`
  - 引入 `activity-admin-console.css`

### 5. 模块跟踪补充

- 新增模块级 tracker：`docs/ACTIVITY_ADMIN_MODULE_PENDING_FEATURES_TRACKER.md`
  - 单独跟踪活动后台模块剩余工作，避免只在平台总表中记录
