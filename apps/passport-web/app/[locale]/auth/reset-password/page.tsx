import { ResetPasswordForm } from "@/components/auth-email-forms";
import type { Locale } from "@/lib/site-content";

export default function LocalizedResetPasswordPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { email?: string; token?: string };
}) {
  const isZh = params.locale === "zh";

  return (
    <div className="proto-auth-grid">
      <section className="proto-auth-value">
        <span className="hero-kicker">{isZh ? "账户安全" : "Account Security"}</span>
        <h1>{isZh ? "重置密码" : "Reset Password"}</h1>
        <p>
          {isZh
            ? "输入邮件中的验证码或 token，并设置一个新密码。"
            : "Provide the code or token from your email and set a new password."}
        </p>
      </section>
      <section className="proto-auth-form-side">
        <span className="label">{isZh ? "密码重置" : "Password Reset"}</span>
        <h3>{isZh ? "设置新密码" : "Set new password"}</h3>
        <ResetPasswordForm initialEmail={searchParams?.email} initialToken={searchParams?.token} locale={params.locale} />
      </section>
    </div>
  );
}
