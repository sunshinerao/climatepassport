"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/site-content";

type ApiResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  redirectTo?: string;
};

export function VerifyEmailForm(props: {
  locale: Locale;
  initialEmail?: string;
  initialToken?: string;
  nextPath?: string;
}) {
  const isZh = props.locale === "zh";
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [token, setToken] = useState(props.initialToken ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function submitConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    const payload = {
      locale: props.locale,
      next: props.nextPath ?? "",
      email,
      token: token || undefined,
      code: code || undefined,
    };

    try {
      const response = await fetch("/api/auth/verify-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? (isZh ? "验证失败，请重试。" : "Verification failed. Please try again."));
        setIsSubmitting(false);
        return;
      }

      window.location.assign(result.redirectTo ?? `/${props.locale}/dashboard/climate-passport`);
    } catch {
      setError(isZh ? "网络异常，请稍后再试。" : "Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  async function submitResend() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError(isZh ? "请先填写邮箱。" : "Please fill in your email first.");
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch("/api/auth/verify-email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: props.locale, email }),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? (isZh ? "重发失败，请稍后再试。" : "Unable to resend now. Please try again."));
        setIsResending(false);
        return;
      }

      setMessage(isZh ? "验证邮件已发送，请查看邮箱。" : "Verification email sent. Please check your inbox.");
    } catch {
      setError(isZh ? "网络异常，请稍后再试。" : "Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <form className="form-grid" noValidate onSubmit={submitConfirm}>
      <label className="field">
        <span>{isZh ? "邮箱" : "Email"}</span>
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.currentTarget.value)}
          placeholder="name@example.com"
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span>{isZh ? "验证码（6位）" : "Verification code (6 digits)"}</span>
        <input
          inputMode="numeric"
          name="code"
          onChange={(event) => setCode(event.currentTarget.value)}
          pattern="[0-9]*"
          placeholder="123456"
          type="text"
          value={code}
        />
      </label>

      <label className="field">
        <span>{isZh ? "验证链接 Token（可选）" : "Verification link token (optional)"}</span>
        <input
          name="token"
          onChange={(event) => setToken(event.currentTarget.value)}
          placeholder={isZh ? "如果来自邮件链接通常会自动填充" : "Usually auto-filled when opened from email link"}
          type="text"
          value={token}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="footer-note">{message}</p> : null}

      <div className="button-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? (isZh ? "处理中…" : "Processing…") : (isZh ? "确认验证" : "Verify Email")}
        </button>
        <button className="button-secondary" disabled={isResending} onClick={submitResend} type="button">
          {isResending ? (isZh ? "发送中…" : "Sending…") : (isZh ? "重发验证邮件" : "Resend verification email")}
        </button>
      </div>

      <p className="footer-note">
        <Link href={`/${props.locale}/auth/login`}>{isZh ? "返回登录" : "Back to sign in"}</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm(props: { locale: Locale }) {
  const isZh = props.locale === "zh";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: props.locale, email }),
      });

      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? (isZh ? "提交失败，请稍后再试。" : "Unable to submit. Please try again."));
        setIsSubmitting(false);
        return;
      }

      setMessage(
        result.message ?? (isZh ? "如果该邮箱存在，我们已发送重置说明。" : "If this email exists, we have sent reset instructions."),
      );
    } catch {
      setError(isZh ? "网络异常，请稍后再试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" noValidate onSubmit={handleSubmit}>
      <label className="field">
        <span>{isZh ? "邮箱" : "Email"}</span>
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.currentTarget.value)}
          placeholder="name@example.com"
          type="email"
          value={email}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="footer-note">{message}</p> : null}

      <div className="button-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? (isZh ? "处理中…" : "Processing…") : (isZh ? "发送重置邮件" : "Send reset email")}
        </button>
      </div>

      <p className="footer-note">
        <Link href={`/${props.locale}/auth/login`}>{isZh ? "返回登录" : "Back to sign in"}</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm(props: {
  locale: Locale;
  initialEmail?: string;
  initialToken?: string;
}) {
  const isZh = props.locale === "zh";
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [token, setToken] = useState(props.initialToken ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token: token || undefined,
          code: code || undefined,
          password,
        }),
      });

      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        setError(result.error ?? (isZh ? "重置失败，请稍后再试。" : "Unable to reset password. Please try again."));
        setIsSubmitting(false);
        return;
      }

      setMessage(isZh ? "密码已重置，请返回登录。" : "Password reset complete. Please sign in.");
    } catch {
      setError(isZh ? "网络异常，请稍后再试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" noValidate onSubmit={handleSubmit}>
      <label className="field">
        <span>{isZh ? "邮箱" : "Email"}</span>
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.currentTarget.value)}
          placeholder="name@example.com"
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span>{isZh ? "重置码（6位）" : "Reset code (6 digits)"}</span>
        <input
          inputMode="numeric"
          name="code"
          onChange={(event) => setCode(event.currentTarget.value)}
          pattern="[0-9]*"
          placeholder="123456"
          type="text"
          value={code}
        />
      </label>

      <label className="field">
        <span>{isZh ? "重置链接 Token（可选）" : "Reset link token (optional)"}</span>
        <input
          name="token"
          onChange={(event) => setToken(event.currentTarget.value)}
          placeholder={isZh ? "如果来自邮件链接通常会自动填充" : "Usually auto-filled when opened from email link"}
          type="text"
          value={token}
        />
      </label>

      <label className="field">
        <span>{isZh ? "新密码" : "New password"}</span>
        <input
          autoComplete="new-password"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.currentTarget.value)}
          placeholder={isZh ? "至少 8 位字符" : "At least 8 characters"}
          type="password"
          value={password}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="footer-note">{message}</p> : null}

      <div className="button-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? (isZh ? "处理中…" : "Processing…") : (isZh ? "重置密码" : "Reset password")}
        </button>
      </div>

      <p className="footer-note">
        <Link href={`/${props.locale}/auth/login`}>{isZh ? "返回登录" : "Back to sign in"}</Link>
      </p>
    </form>
  );
}
