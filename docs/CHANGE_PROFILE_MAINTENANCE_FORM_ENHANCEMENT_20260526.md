# Profile 维护表单增强说明（2026-05-26）

## 需求解读

本次针对“完善我的资料”页面提出 4 点交互与校验增强：

1. 称谓从自由输入改为下拉选项。
2. 国家/地区与联系电话同一行；国家/地区改为可键盘输入快速定位的下拉选择。
3. 头像改为上传并保存，展示图片大小/尺寸要求；上传后支持预览与重新上传。
4. 机构网站字段必须校验为合法网址。

## 修改方法

1. 表单结构与交互改造：
   - 基础资料 tab 中将称谓改为 `select`。
   - 将电话与国家/地区放入同一行网格容器。
   - 国家/地区使用 `input + datalist`，支持输入时快速定位候选项。
2. 头像上传流程：
   - 使用 `file` 输入，仅允许 PNG/JPG/WEBP。
   - 客户端校验文件大小（<=2MB）与图片像素范围（200~4000）。
   - 读取为 Data URL 后保存到 `avatar` 字段，页面即时预览，支持重复上传覆盖。
3. 网址校验：
   - 前端提交前校验机构网站必须是 `http/https` URL。
   - 后端 Zod schema 同步添加 `http/https` URL refine 校验。
4. 样式增强：
   - 增加双列字段行、头像预览块、提示文案样式和移动端降列适配。

## 修改内容

- 表单与交互：
  - `apps/passport-web/components/profile-maintenance-form.tsx`
    - 新增称谓下拉、国家/地区 datalist、电话+国家同排布局。
    - 新增头像上传/预览/重传逻辑与文件校验。
    - 新增机构网站前端格式校验。
- API 校验：
  - `apps/passport-web/app/api/dashboard/profile/route.ts`
    - `organization.website` 增加 URL 协议校验（仅 http/https）。
      - `avatar` 字段最大长度扩展，支持上传后 Data URL 保存。
      - 对齐注册必填规则：`phone`、`country`、`organization.name` 必填。

## 追加调整（同日）

1. 将头像文件大小限制由 2MB 收紧为 500KB（前端提示与校验同步更新）。
2. 对齐注册必填字段：在资料维护提交时，`联系电话`、`国家/地区`、`机构名称` 必填，且界面新增必填星标。
3. 后端接口同步强制同样必填约束，避免绕过前端提交空值。
4. 国家/地区选项升级为 ISO 区域全集：基于 `Intl.supportedValuesOf("region")` + `Intl.DisplayNames` 生成本地化候选项，并按当前语言排序；注册页与资料维护页共用同一数据源，支持键盘输入快速检索。
- 样式：
  - `apps/passport-web/app/styles/features/dashboard-redesign.css`
    - 新增 `profile-maintenance-field-row-two`、`field-hint`、`profile-avatar-preview` 等样式。

## 追加调整（ISO 国家/地区全集）

- 新增共享国家/地区候选工具：
   - `apps/passport-web/lib/country-options.ts`
      - 封装 `getCountryOptions(locale)`，按 `zh/en/fr/de` 生成本地化国家/地区名称。
      - 优先使用 `Intl.supportedValuesOf("region")` 保障覆盖面；运行环境不支持时回退到基础国家列表。
- 注册页对齐：
   - `apps/passport-web/components/auth-form.tsx`
      - 注册表单 `country` 改为 `input + datalist`，支持完整候选列表与键盘检索。
- 资料维护页对齐：
   - `apps/passport-web/components/profile-maintenance-form.tsx`
      - 移除硬编码国家列表，改为复用共享 ISO 候选工具，确保与注册页一致。

## 追加调整（视觉与交互修正）

### 需求解读

1. 头像上传区域原生文件输入样式过于突兀，需要与整体卡片/按钮风格统一。
2. 国家/地区字段在部分浏览器下 `datalist` 下拉可见性不稳定，用户感知为“没有下拉选项”。

### 修改方法

1. 用隐藏文件输入 + 自定义触发按钮替代原生 `type=file` 视觉。
2. 新增可复用 `CountryCombobox` 组件，改为受控输入 + 可见候选面板（支持点击展开、键盘上下选择、回车确认、过滤匹配）。
3. 注册页与资料维护页统一接入该组件，消除浏览器 `datalist` 差异。

### 修改内容

- 新增：
   - `apps/passport-web/components/country-combobox.tsx`
      - 统一国家/地区可搜索下拉组件。
- 更新：
   - `apps/passport-web/components/profile-maintenance-form.tsx`
      - 国家/地区改接 `CountryCombobox`。
      - 头像上传改为主题化按钮 + 已选文件名显示。
   - `apps/passport-web/components/auth-form.tsx`
      - 注册国家/地区改接 `CountryCombobox`，保持与资料维护页一致。
   - `apps/passport-web/app/styles/features/dashboard-redesign.css`
      - 增加头像上传按钮与国家下拉面板样式。
   - `apps/passport-web/app/styles/features/enhanced-registration-form.css`
      - 增加国家下拉面板样式。

## 追加修正（下拉展示行为）

- 问题：国家/地区字段在已有默认值时，点击输入框后候选列表会按当前值过滤，导致只显示极少选项；同时右侧额外下拉小箭头造成视觉冗余。
- 修正：
   - `apps/passport-web/components/country-combobox.tsx`
      - 点击/聚焦时默认展示完整候选列表，仅在用户实际输入时按关键字过滤。
      - 移除输入框右侧的额外下拉按钮（小箭头）。
   - `apps/passport-web/components/profile-maintenance-form.tsx`
      - 国家/地区占位文案同步调整，不再提示“点击右侧箭头”。
   - `apps/passport-web/app/styles/features/dashboard-redesign.css`
   - `apps/passport-web/app/styles/features/enhanced-registration-form.css`
      - 清理已移除下拉按钮的冗余样式。

## 追加优化（国家选择效率）

- 目标：提升国家/地区选择效率，减少滚动与输入成本。
- 策略：
   - 打开下拉时按 `当前值置顶 -> 常用国家置顶 -> 其余项` 展示。
   - 输入关键字后按 `前缀匹配优先`，其次为包含匹配。
- 实现：
   - `apps/passport-web/lib/country-options.ts`
      - 新增 `getPreferredCountryOptions(locale)`（常用国家本地化名称）。
   - `apps/passport-web/components/country-combobox.tsx`
      - 新增 `preferredOptions` 支持并实现排序策略。
   - `apps/passport-web/components/profile-maintenance-form.tsx`
   - `apps/passport-web/components/auth-form.tsx`
      - 注册/资料维护统一接入常用项优先策略。

## 追加修正（网站校验与气候护照视觉对齐）

- 机构网站校验：
   - 问题反馈：用户感知网站字段校验未生效。
   - 修正策略：前后端统一收紧校验规则，要求网址必须满足：
      - 协议为 `http://` 或 `https://`
      - 主机名合法（包含 `.`，或为 `localhost`）
   - 变更文件：
      - `apps/passport-web/components/profile-maintenance-form.tsx`
      - `apps/passport-web/app/api/dashboard/profile/route.ts`

- 资料完整度圆环：
   - 百分比数字改为圆环几何中心绝对居中。
   - 数字字体与全局数字风格对齐（Inter 系列，权重/字距与其他指标数字一致）。
   - 变更文件：
      - `apps/passport-web/app/styles/features/dashboard-redesign.css`

- 左侧头衔（如 CEO）与姓名底部对齐：
   - 将姓名与头衔容器的对齐方式由居中改为底部对齐。
   - 变更文件：
      - `apps/passport-web/app/styles/features/dashboard-redesign.css`
