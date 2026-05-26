# CHANGE_AUTH_LOGIN_PROCESSING_NAV_SYNC_20260527

## 需求解读
- 用户反馈登录按钮在提交后会先显示“处理中...”，随后又短暂回到“登录”，最后才跳转页面。
- 期望行为是：处理完成后立即发生页面跳转，不出现“处理中...”结束后又回退到“登录”的中间态。
- 同时要求在不影响现有登录异常提示逻辑的前提下，最小范围修复交互时序。

## 修改方法
- 调整登录表单成功提交分支的导航方式，使成功后立刻执行页面级跳转。
- 将提交态恢复（`setIsSubmitting(false)`）仅保留在失败分支，避免成功分支先恢复按钮文案再导航。
- 清理该文件中因导航策略变更而不再使用的 `useRouter` 相关引用，保证代码整洁并避免无用变量。

## 修改内容
- 文件：`apps/passport-web/components/auth-form.tsx`
- 具体改动：
  - 成功登录后由原先客户端路由刷新链路切换为 `window.location.assign(nextPath)`，确保成功时直接进入目标页面。
  - 成功分支不再执行 `setIsSubmitting(false)`，防止按钮文案回退闪烁。
  - 失败分支继续执行 `setIsSubmitting(false)`，维持错误提示与可重试交互。
  - 删除未使用的 `useRouter` import 及 `router` 变量。
- 验证结果：
  - 执行 `npm run build` 通过。
  - 构建过程中仅存在既有 ESLint Hook 依赖告警，无新增错误或类型问题。
