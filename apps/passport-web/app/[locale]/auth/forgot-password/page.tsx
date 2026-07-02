import { ForgotPasswordForm } from "@/components/auth-email-forms";
import type { Locale } from "@/lib/site-content";

export default function LocalizedForgotPasswordPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const isZh = params.locale === "zh";

  return (
    <div className="proto-auth-grid">
      <section className="proto-auth-value">
        <span className="hero-kicker">{isZh ? "账户安全" : "Account Security"}</span>
        <h1>{isZh ? "忘记密码" : "Forgot Password"}</h1>
        <p>
          {isZh
            ? "输入你的注册邮箱，我们会发送密码重置邮件。"
            : "Enter your registered email and we will send a secure password reset message."}
        </p>
      </section>
      <section className="proto-auth-form-side">
        <span className="label">{isZh ? "密码找回" : "Password Recovery"}</span>
        <h3>{isZh ? "请求重置邮件" : "Request reset email"}</h3>
        <ForgotPasswordForm locale={params.locale} />
      </section>
    </div>
  );
}
