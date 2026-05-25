# BUGFIX_CERTIFICATE_ISSUE_AUTO_CREATE_PASSPORT_AND_HOLDER_AUTOFILL_20260525

## 需求解读
- 证书签发时，如果输入的 Email 尚未注册 Climate Passport，需要自动生成对应的 Climate Passport 身份并直接继续签发，不能再以“用户不存在”中断流程。
- 这段自动生成逻辑应尽量复用夏校申请中已经成熟的“临时创建 Passport 用户并补齐 Climate Passport ID”的实现思路，避免重复维护两套逻辑。
- 如果输入的 Email 已经对应现有 Climate Passport 用户，单个签发表单中的“证书持有人”应默认回填该 Passport 持有人姓名，但不能强制覆盖管理员后续手工修改。
- 自动创建出来的临时用户后续仍需能够完成正式注册，因此不能让注册流程只接受“夏校临时用户”。

## 修改方法
- 抽取共享服务端 helper，统一处理“按邮箱查找用户、缺失时创建临时 Passport 用户、缺失 Climate Passport ID 时补齐”的逻辑。
- 夏校申请接口改为调用共享 helper，确保此次证书签发自动建号确实复用了同一条成熟实现链路。
- 证书签发接口改为在事务内先确保收件人 Passport 用户存在，再继续做重复签发校验、验证码分配、证书渲染、落库和审计。
- 新增一个管理员邮箱查询接口，前端在单个签发表单中对合法邮箱做轻量查询，只在持有人字段为空或仍保持上一次自动回填值时才自动覆盖。
- 放宽注册接口对临时账号的激活条件，使任何 `PENDING` 的预置 Passport 账号都能完成正式注册。

## 修改内容
- 新增 `apps/passport-web/lib/server/passport-user-provisioning.ts`：封装 `ensurePassportUserByEmail(...)`，内部复用现有 `generateClimatePassportId`、`hashUserPassword`、`normalizeUserEmail`。
- 修改 `apps/passport-web/app/api/summer-school/apply/route.ts`：改为通过共享 helper 创建或补齐 Summer School 申请人的 Passport 用户。
- 修改 `apps/passport-web/app/api/admin/certificates/issue/route.ts`：
  - 对单个与批量收件人统一做标准化邮箱处理；
  - 收件人不存在时自动创建 `PENDING` 的 Passport 用户并补齐 Climate Passport ID；
  - 创建后直接继续签发，不再返回 404；
  - 在审计 metadata 中补充 `recipientCreated` 与 `recipientClimatePassportId`。
- 新增 `apps/passport-web/app/api/admin/certificates/recipient/route.ts`：支持管理员按邮箱查询现有 Passport 用户，用于前端持有人默认回填。
- 修改 `apps/passport-web/components/certificate-admin-prototype.tsx`：
  - 单个签发表单对合法邮箱做延迟查询；
  - 如果查询到现有 Passport 用户，则默认把“证书持有人”回填为该用户姓名；
  - 如果管理员已经手工修改持有人姓名，则后续自动回填不再覆盖。
- 修改 `apps/passport-web/app/api/auth/register/route.ts`：允许任意 `PENDING` 的预置 Passport 账号完成正式注册，不再仅限 Summer School 临时账号。
