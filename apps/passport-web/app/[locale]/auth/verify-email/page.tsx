import Link from "next/link";
import { VerifyEmailForm } from "@/components/auth-email-forms";
import type { Locale } from "@/lib/site-content";

export default function LocalizedVerifyEmailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { email?: string; token?: string; next?: string };
}) {
  const isZh = params.locale === "zh";

  return (
    <div className="proto-auth-grid">
      <section className="proto-auth-value">
        <span className="hero-kicker">{isZh ? "账户安全" : "Account Security"}</span>
        <h1>{isZh ? "验证邮箱" : "Verify Email"}</h1>
        <p>
          {isZh
            ? "请输入邮件中的验证码，或直接使用邮件链接中的 token 完成验证。"
            : "Enter the verification code from your email, or use the token from the secure email link."}
        </p>
      </section>
      <section className="proto-auth-form-side">
        <span className="label">{isZh ? "邮箱验证" : "Email Verification"}</span>
        <h3>{isZh ? "完成账户激活" : "Complete account activation"}</h3>
        <VerifyEmailForm
          initialEmail={searchParams?.email}
          initialToken={searchParams?.token}
          locale={params.locale}
          nextPath={searchParams?.next}
        />
        <p className="footer-note">
          <Link href={`/${params.locale}/auth/register`}>
            {isZh ? "还没有账户？立即注册" : "No account yet? Create one"}
          </Link>
        </p>
      </section>
    </div>
  );
}
