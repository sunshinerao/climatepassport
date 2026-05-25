# BUGFIX_VISUAL_REGRESSION_CERTIFICATE_VERIFY_CSS_20260525

## 需求解读

- 用户要求暂停样式拆分，优先执行页面级视觉回归验证。
- 验证过程中首页出现 Next.js Build Error，导致页面无法正常渲染。
- 需要先做最小修复解除阻塞，再继续页面与 API 回归检查。

## 修改方法

- 从构建报错定位到 `certificate-verify.css` 末尾存在未闭合注释。
- 采用最小改动策略，仅删除悬空注释行，不改动任何业务样式规则。
- 修复后重跑页面回归与自动化测试确认无二次回归。

## 修改内容

- 修改文件：`apps/passport-web/app/styles/features/certificate-verify.css`
  - 删除末尾悬空注释起始行 `/* ============================================================`。

- 页面级视觉回归结果（本地 `next dev`）：
  - `200`：`/en`、`/zh`、`/en/events`、`/en/speakers`、`/en/about`、`/en/contact`、`/en/privacy`、`/en/terms`、`/en/faq`、`/en/admin`、`/en/auth/login`、`/en/auth/register`、`/en/certificates`、`/en/dashboard/climate-passport`。
  - 未发现 Build Error / Runtime Error 覆盖层。

- API 回归结果（抽样）：
  - 可达（无 500）：`/api/auth/session`(200), `/api/learning-experiences/programs`(200), `/api/summer-school/passport-id`(200), `/api/summer-school/application-lookup`(200)
  - 受方法/鉴权影响但正常：`/api/auth/login`(405), `/api/auth/register`(405), `/api/auth/logout`(405), `/api/admin/events`(307), `/api/qr/identity`(405), `/api/verifier/scan`(405)

- 自动化回归：
  - `npm test`：`38 passed / 0 failed`。
