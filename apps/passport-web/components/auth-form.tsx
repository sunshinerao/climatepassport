"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CountryCombobox } from "@/components/country-combobox";
import type { Locale } from "@/lib/site-content";
import { getCountryOptions, getPreferredCountryOptions } from "@/lib/country-options";

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
  const isZh = props.locale === "zh";
  const countryOptions = getCountryOptions(props.locale);
  const preferredCountryOptions = getPreferredCountryOptions(props.locale);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerCountry, setRegisterCountry] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function getFieldError(name: string): string | undefined {
    return fieldErrors[name];
  }

  function clearError(name: string) {
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const errs: Record<string, string> = {};

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email) errs.email = isZh ? "请填写邮筱地址。" : "Email address is required.";
    if (!password) errs.password = isZh ? "请填写密码。" : "Password is required.";

    if (props.mode === "register") {
      if (!String(formData.get("name") ?? "").trim()) errs.name = isZh ? "请填写真实姓名。" : "Full name is required.";
      if (!String(formData.get("phone") ?? "").trim()) errs.phone = isZh ? "请填写手机号码。" : "Phone number is required.";
      if (!String(formData.get("country") ?? "").trim()) errs.country = isZh ? "请填写国家 / 地区。" : "Country / Region is required.";
      if (!String(formData.get("organizationName") ?? "").trim()) errs.organizationName = isZh ? "请填写机构 / 单位名称。" : "Organization name is required.";
      if (password.length > 0 && password.length < 8) errs.password = isZh ? "密码至少需要 8 位字符。" : "Password must be at least 8 characters.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    const payload: Record<string, string> = {
      locale: props.locale,
      next: props.nextPath ?? "",
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    if (props.mode === "register") {
      payload.name = String(formData.get("name") ?? "");
      const salutation = String(formData.get("salutation") ?? "").trim();
      const title = String(formData.get("title") ?? "").trim();

      if (salutation) payload.salutation = salutation;
      if (title) payload.title = title;
      payload.phone = String(formData.get("phone") ?? "").trim();
      payload.country = String(formData.get("country") ?? "").trim();
      payload.organizationName = String(formData.get("organizationName") ?? "").trim();
    }

    try {
      const response = await fetch(`/api/auth/${props.mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
        requiresVerification?: boolean;
      };

      if (!response.ok) {
        if (result.redirectTo && result.requiresVerification) {
          window.location.assign(result.redirectTo);
          return;
        }

        setError(result.error ?? "Unable to complete this request.");
        setIsSubmitting(false);
        return;
      }

      const nextPath = result.redirectTo ?? `/${props.locale}/dashboard/climate-passport`;
      window.location.assign(nextPath);
      return;
    } catch {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" noValidate onSubmit={handleSubmit}>
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
              <span>{props.labels.name}<span className="req-star">*</span></span>
              <input name="name" onChange={() => clearError("name")} placeholder={isZh ? "真实姓名" : "Full name"} type="text" />
              {getFieldError("name") && <span className="field-error">{getFieldError("name")}</span>}
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>{isZh ? "职务 / 头衔" : "Title / Position"}</span>
              <input name="title" placeholder={isZh ? "如：气候政策研究员" : "e.g. Climate Policy Analyst"} type="text" />
            </label>
            <label className="field">
              <span>{isZh ? "手机号码" : "Phone"}<span className="req-star">*</span></span>
              <input name="phone" onChange={() => clearError("phone")} placeholder={isZh ? "+86 138 0000 0000" : "+1 555 000 0000"} type="tel" />
              {getFieldError("phone") && <span className="field-error">{getFieldError("phone")}</span>}
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>{isZh ? "国家 / 地区" : "Country / Region"}<span className="req-star">*</span></span>
              <CountryCombobox
                ariaLabel={isZh ? "国家或地区" : "Country or Region"}
                id="register-country"
                name="country"
                noOptionsText={isZh ? "没有匹配选项" : "No matching options"}
                onBlur={() => clearError("country")}
                onChange={(value) => {
                  setRegisterCountry(value);
                  clearError("country");
                }}
                options={countryOptions}
                preferredOptions={preferredCountryOptions}
                placeholder={isZh ? "输入即可搜索国家/地区" : "Type to search country/region"}
                value={registerCountry}
              />
              {getFieldError("country") && <span className="field-error">{getFieldError("country")}</span>}
            </label>
            <label className="field">
              <span>{isZh ? "机构 / 单位名称" : "Organization / Institution"}<span className="req-star">*</span></span>
              <input name="organizationName" onChange={() => clearError("organizationName")} placeholder={isZh ? "如：清华大学" : "e.g. Tsinghua University"} type="text" />
              {getFieldError("organizationName") && <span className="field-error">{getFieldError("organizationName")}</span>}
            </label>
          </div>
        </>
      ) : null}

      <label className="field">
        <span>{props.labels.email}<span className="req-star">*</span></span>
        <input name="email" onChange={() => clearError("email")} placeholder="name@example.com" type="email" />
        {getFieldError("email") && <span className="field-error">{getFieldError("email")}</span>}
      </label>
      <label className="field">
        <span>{props.labels.password}<span className="req-star">*</span></span>
        <input name="password" onChange={() => clearError("password")} placeholder={isZh ? "至少 8 位字符" : "At least 8 characters"} type="password" />
        {getFieldError("password") && <span className="field-error">{getFieldError("password")}</span>}
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {props.mode === "login" ? (
        <p className="footer-note">
          <Link href={`/${props.locale}/auth/forgot-password`}>{isZh ? "忘记密码？" : "Forgot password?"}</Link>
          {" · "}
          <Link href={`/${props.locale}/auth/verify-email`}>{isZh ? "验证邮箱" : "Verify email"}</Link>
        </p>
      ) : null}
      <div className="button-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? (isZh ? "处理中…" : "Processing…") : props.labels.submit}
        </button>
      </div>
    </form>
  );
}
