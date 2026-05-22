"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-content";

type SharedLabels = {
  email: string;
  password: string;
  submit: string;
};

type LoginLabels = SharedLabels;

type RegisterLabels = SharedLabels & {
  name: string;
};

type AuthFormProps =
  | {
      mode: "login";
      locale: Locale;
      nextPath?: string;
      labels: LoginLabels;
    }
  | {
      mode: "register";
      locale: Locale;
      nextPath?: string;
      labels: RegisterLabels;
    };

const SALUTATIONS = ["Dr.", "Prof.", "Mr.", "Ms.", "Mx.", "Rev."];

export function AuthForm(props: AuthFormProps) {
  const router = useRouter();
  const isZh = props.locale === "zh";
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOrgSection, setShowOrgSection] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      locale: props.locale,
      next: props.nextPath ?? "",
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    if (props.mode === "register") {
      payload.name = String(formData.get("name") ?? "");
      payload.salutation = String(formData.get("salutation") ?? "");
      payload.title = String(formData.get("title") ?? "");
      payload.phone = String(formData.get("phone") ?? "");
      payload.country = String(formData.get("country") ?? "");
      payload.organizationName = String(formData.get("organizationName") ?? "");
    }

    try {
      const response = await fetch(`/api/auth/${props.mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to complete this request.");
        return;
      }

      router.replace(result.redirectTo ?? `/${props.locale}/dashboard/climate-passport`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {props.mode === "register" ? (
        <>
          {/* ── Basic info ── */}
          <div className="field-row">
            <label className="field">
              <span>{isZh ? "称谓" : "Salutation"}</span>
              <select name="salutation">
                <option value="">{isZh ? "（可选）" : "(optional)"}</option>
                {SALUTATIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{props.labels.name}</span>
              <input name="name" placeholder={isZh ? "真实姓名" : "Full name"} required type="text" />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>{isZh ? "职务 / 头衔" : "Title / Position"}</span>
              <input name="title" placeholder={isZh ? "如：气候政策研究员" : "e.g. Climate Policy Analyst"} type="text" />
            </label>
            <label className="field">
              <span>{isZh ? "手机号码" : "Phone"}</span>
              <input name="phone" placeholder={isZh ? "+86 138 0000 0000" : "+1 555 000 0000"} type="tel" />
            </label>
          </div>

          <label className="field">
            <span>{isZh ? "国家 / 地区" : "Country / Region"}</span>
            <input name="country" placeholder={isZh ? "如：中国" : "e.g. China"} type="text" />
          </label>

          {/* ── Toggle org section ── */}
          <button
            className="form-section-toggle"
            onClick={() => setShowOrgSection((v) => !v)}
            type="button"
          >
            {showOrgSection
              ? (isZh ? "▲ 隐藏机构信息（可选）" : "▲ Hide organization info (optional)")
              : (isZh ? "▼ 添加机构 / 单位信息（可选）" : "▼ Add organization info (optional)")}
          </button>

          {showOrgSection && (
            <label className="field">
              <span>{isZh ? "机构 / 单位名称" : "Organization / Institution"}</span>
              <input name="organizationName" placeholder={isZh ? "如：清华大学" : "e.g. Tsinghua University"} type="text" />
            </label>
          )}
        </>
      ) : null}

      <label className="field">
        <span>{props.labels.email}</span>
        <input name="email" placeholder="name@example.com" required type="email" />
      </label>
      <label className="field">
        <span>{props.labels.password}</span>
        <input name="password" placeholder={isZh ? "至少 8 位字符" : "At least 8 characters"} required type="password" minLength={8} />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      <div className="button-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? (isZh ? "处理中…" : "Processing…") : props.labels.submit}
        </button>
      </div>
    </form>
  );
}
