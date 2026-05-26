# 注册必填字段变更文档

**日期：** 2026-05-24  
**Commit：** `b55423b`

---

## 需求解读

用户要求：
1. 手机号码、机构名称、国家/地区在注册时必填
2. 邮箱验证功能暂时挂起（尚无邮件发送配置，功能本身未实现，无需改动）
3. 密码复杂度要求暂时挂起（功能本身未实现，无需改动）
4. 注册确认邮件处理同邮箱验证，暂时挂起
5. 客户端校验与服务端保持一致
6. 管理员创建证书时，该邮箱对应的 Climate Passport 用户 status 走 PENDING 逻辑（**已满足，无需改动**）

---

## 修改方法

- **UI 层**（`auth-form.tsx`）：移除机构信息的可折叠 toggle，将机构名称字段始终渲染，三个字段均添加 HTML `required` 属性；payload 构建时无条件包含三个字段（移除 `if (phone)` 等条件保护）
- **API 层**（`register/route.ts`）：Zod schema 中三个字段从 `.optional()` 改为 `.min(1)`（必填）；数据库写入时直接使用 `organization.create/upsert`，移除条件展开 `...(organizationName ? {...} : {})`

---

## 修改内容

### `apps/passport-web/components/auth-form.tsx`
- 删除 `showOrgSection` state 和 toggle 按钮
- `phone` 输入框：添加 `required` 属性
- `country` 输入框：添加 `required` 属性，移入第二个 `field-row`（与 org 并排）
- `organizationName` 输入框：移出条件渲染块，添加 `required` 属性
- `handleSubmit`：移除 `if (phone) payload.phone = phone` 等三个条件赋值，直接 `payload.phone = ...`

### `apps/passport-web/app/api/auth/register/route.ts`
- `phone: z.string().trim().max(40).optional()` → `z.string().trim().min(1, "...").max(40)`
- `country: z.string().trim().max(80).optional()` → `z.string().trim().min(1, "...").max(80)`
- `organizationName: z.string().trim().max(160).optional()` → `z.string().trim().min(1, "...").max(160)`
- PENDING 用户激活路径：`organization.upsert` 直接使用，移除条件展开
- 新建用户路径：`organization.create` 直接使用，移除条件展开

### 已确认无需改动
- `apps/passport-web/app/api/admin/certificates/issue/route.ts`：已传入 `status: "PENDING"`，满足需求 2
- `apps/passport-web/lib/server/passport-user-provisioning.ts`：`status: input.status ?? "PENDING"` 默认即为 PENDING
