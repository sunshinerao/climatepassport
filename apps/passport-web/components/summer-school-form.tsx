"use client";

import Link from "next/link";
import { useState, useRef, type ReactNode, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-content";

type SummerSchoolFormProps = {
  locale: Locale;
  climatePassportId?: string | null;
  headerRow?: ReactNode;
};

type FormData = {
  fullName: string;
  preferredName: string;
  dob: string;
  nationality: string;
  school: string;
  grade: string;
  email: string;
  phone: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  channel: string;
  explorationStage: string;
  coreIssue: string;
  practiceProof: string;
  portfolioUrl: string;
  aiRole: string;
  aiTools: string;
  aiBlindspot: string;
  expectation: string;
  futurePath: string[];
  languageComfort: string;
  travelCommitment: string;
  financialAid: string;
  financialAidNote: string;
  commitment: boolean;
  integrity: boolean;
  passportConsent: boolean;
  privacyConsent: boolean;
  passportId: string;
  accountAction: string;
};

const INITIAL: FormData = {
  fullName: "", preferredName: "", dob: "", nationality: "", school: "", grade: "",
  email: "", phone: "", guardianName: "", guardianEmail: "", guardianPhone: "",
  channel: "", explorationStage: "", coreIssue: "", practiceProof: "",
  portfolioUrl: "", aiRole: "", aiTools: "", aiBlindspot: "", expectation: "",
  futurePath: [], languageComfort: "", travelCommitment: "", financialAid: "",
  financialAidNote: "", commitment: false, integrity: false, passportConsent: false, privacyConsent: false,
  passportId: "", accountAction: "",
};

const TOTAL_STEPS = 6;

const COUNTRIES_ZH = [
  "中国", "美国", "英国", "加拿大", "澳大利亚", "新西兰", "德国", "法国", "日本",
  "韩国", "新加坡", "马来西亚", "泰国", "印度尼西亚", "印度", "巴西", "墨西哥",
  "南非", "尼日利亚", "埃及", "俄罗斯", "意大利", "西班牙", "荷兰", "瑞典",
  "挪威", "丹麦", "芬兰", "瑞士", "奥地利", "比利时", "葡萄牙", "波兰",
  "捷克", "匈牙利", "阿根廷", "智利", "哥伦比亚", "秘鲁", "越南", "菲律宾",
  "巴基斯坦", "孟加拉国", "斯里兰卡", "尼泊尔", "沙特阿拉伯", "阿联酋", "其他",
];

const COUNTRIES_EN = [
  "China", "United States", "United Kingdom", "Canada", "Australia", "New Zealand",
  "Germany", "France", "Japan", "South Korea", "Singapore", "Malaysia", "Thailand",
  "Indonesia", "India", "Brazil", "Mexico", "South Africa", "Nigeria", "Egypt",
  "Russia", "Italy", "Spain", "Netherlands", "Sweden", "Norway", "Denmark",
  "Finland", "Switzerland", "Austria", "Belgium", "Portugal", "Poland",
  "Czech Republic", "Hungary", "Argentina", "Chile", "Colombia", "Peru",
  "Vietnam", "Philippines", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal",
  "Saudi Arabia", "UAE", "Other",
];

type FieldError = { id: string; msg: string };

function parseDob(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12) return null;

  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day, date: parsed };
}

function normalizeDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatDobForApi(value: string): string {
  const parsed = parseDob(value);
  if (!parsed) return value;
  const month = String(parsed.month).padStart(2, "0");
  const day = String(parsed.day).padStart(2, "0");
  return `${parsed.year}-${month}-${day}`;
}

function validateStep1(data: FormData, isZh: boolean): FieldError[] {
  const errors: FieldError[] = [];
  if (!data.fullName.trim()) errors.push({ id: "fullName", msg: isZh ? "请填写全名" : "Full name is required" });
  if (!data.dob.trim()) {
    errors.push({ id: "dob", msg: isZh ? "请填写出生日期（MM/DD/YYYY）" : "Date of birth is required (MM/DD/YYYY)" });
  } else {
    const parsedDob = parseDob(data.dob);
    if (!parsedDob) {
      errors.push({ id: "dob", msg: isZh ? "出生日期格式需为 MM/DD/YYYY，且日期需有效" : "Date of birth must be a valid MM/DD/YYYY date" });
    } else {
      const today = new Date();
      const currentYear = today.getFullYear();
      if (parsedDob.year < 1900 || parsedDob.year > currentYear) {
        errors.push({ id: "dob", msg: isZh ? "年份需在 1900 到当前年份之间" : "Year must be between 1900 and current year" });
      } else if (parsedDob.date > today) {
        errors.push({ id: "dob", msg: isZh ? "出生日期不能晚于今天" : "Date of birth cannot be in the future" });
      }
    }
  }
  if (!data.nationality) errors.push({ id: "nationality", msg: isZh ? "请选择国籍" : "Nationality is required" });
  if (!data.school.trim()) errors.push({ id: "school", msg: isZh ? "请填写就读学校" : "School is required" });
  if (!data.grade) errors.push({ id: "grade", msg: isZh ? "请选择年级" : "Grade is required" });
  if (!data.email.trim()) errors.push({ id: "email", msg: isZh ? "请填写邮箱" : "Email is required" });
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.push({ id: "email", msg: isZh ? "邮箱格式不正确" : "Invalid email address" });
  if (!data.phone.trim()) errors.push({ id: "phone", msg: isZh ? "请填写申请人手机" : "Applicant phone is required" });
  if (!data.guardianName.trim()) errors.push({ id: "guardianName", msg: isZh ? "请填写监护人姓名" : "Guardian name is required" });
  if (!data.guardianEmail.trim()) errors.push({ id: "guardianEmail", msg: isZh ? "请填写监护人邮箱" : "Guardian email is required" });
  if (data.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.guardianEmail))
    errors.push({ id: "guardianEmail", msg: isZh ? "监护人邮箱格式不正确" : "Invalid guardian email" });
  if (!data.guardianPhone.trim()) errors.push({ id: "guardianPhone", msg: isZh ? "请填写监护人手机" : "Guardian phone is required" });
  return errors;
}

function validateStep2(data: FormData, isZh: boolean): FieldError[] {
  const errors: FieldError[] = [];
  if (!data.explorationStage) errors.push({ id: "explorationStage", msg: isZh ? "请选择探索阶段" : "Please select your exploration stage" });
  if (!data.coreIssue.trim()) errors.push({ id: "coreIssue", msg: isZh ? "请填写你最关心的气候问题" : "Please describe the climate issue you care about" });
  return errors;
}

function validateStep3(data: FormData, isZh: boolean): FieldError[] {
  const errors: FieldError[] = [];
  if (!data.aiRole) errors.push({ id: "aiRole", msg: isZh ? "请选择你对 AI 的态度" : "Please select your AI stance" });
  if (!data.aiBlindspot.trim()) errors.push({ id: "aiBlindspot", msg: isZh ? "请填写 AI 的盲区" : "Please describe AI's blind spot" });
  return errors;
}

function validateStep4(data: FormData, isZh: boolean): FieldError[] {
  const errors: FieldError[] = [];
  if (!data.expectation.trim()) errors.push({ id: "expectation", msg: isZh ? "请填写你对夏校的期望" : "Please describe your expectations" });
  return errors;
}

function validateStep5(data: FormData, isZh: boolean): FieldError[] {
  const errors: FieldError[] = [];
  if (!data.languageComfort) errors.push({ id: "languageComfort", msg: isZh ? "请选择语言适应度" : "Please select your language comfort level" });
  if (!data.travelCommitment) errors.push({ id: "travelCommitment", msg: isZh ? "请选择行程承诺" : "Please confirm your travel commitment" });
  return errors;
}

const VALIDATORS = [validateStep1, validateStep2, validateStep3, validateStep4, validateStep5];

export function SummerSchoolForm({ locale, climatePassportId, headerRow }: SummerSchoolFormProps) {
  const router = useRouter();
  const isZh = locale === "zh";
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>({ ...INITIAL, passportId: climatePassportId ?? "" });
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [error, setError] = useState("");
  const [confirmationErrorId, setConfirmationErrorId] = useState<string | null>(null);
  const [confirmationErrorMessage, setConfirmationErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => prev.filter((e) => e.id !== key));
  }

  function toggleFuturePath(value: string) {
    setData((prev) => ({
      ...prev,
      futurePath: prev.futurePath.includes(value)
        ? prev.futurePath.filter((v) => v !== value)
        : [...prev.futurePath, value],
    }));
  }

  function handleTextChange(key: keyof FormData) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setField(key, e.target.value as FormData[typeof key]);
    };
  }

  function handleDobChange(e: ChangeEvent<HTMLInputElement>) {
    setField("dob", normalizeDobInput(e.target.value));
  }

  function getFieldError(id: string): string | undefined {
    return fieldErrors.find((e) => e.id === id)?.msg;
  }

  function handleNext() {
    if (step >= TOTAL_STEPS) return;
    const validator = VALIDATORS[step - 1];
    if (validator) {
      const errors = validator(data, isZh);
      if (errors.length > 0) {
        setFieldErrors(errors);
        const firstId = errors[0].id;
        const el = document.getElementById(`field-${firstId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = el.querySelector("input,select,textarea") as HTMLElement | null;
          input?.focus();
        } else {
          formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
    }
    setFieldErrors([]);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handlePrev() {
    setFieldErrors([]);
    setStep((s) => Math.max(1, s - 1));
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const confirmationChecks = [
      {
        id: "commitment",
        fieldId: "field-commitment",
        message: isZh ? "请先勾选‘承诺认真对待本次申请’。" : "Please confirm you will take this application seriously.",
      },
      {
        id: "integrity",
        fieldId: "field-integrity",
        message: isZh ? "请先勾选‘学术诚信声明’。" : "Please confirm the academic integrity declaration.",
      },
      {
        id: "passportConsent",
        fieldId: "field-passportConsent",
        message: isZh ? "请先勾选‘同意写入 Climate Passport’。" : "Please confirm Climate Passport consent.",
      },
      {
        id: "privacyConsent",
        fieldId: "field-privacyConsent",
        message: isZh ? "请先勾选隐私政策与未成年人同意声明。" : "Please confirm the privacy policy and guardian consent declaration.",
      },
    ] as const;

    for (const item of confirmationChecks) {
      if (!data[item.id]) {
        const el = document.getElementById(item.fieldId);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = el?.querySelector("input") as HTMLElement | null;
        input?.focus();
        setConfirmationErrorId(item.id);
        setConfirmationErrorMessage(item.message);
        setError(item.message);
        return;
      }
    }

    setConfirmationErrorId(null);
    setConfirmationErrorMessage("");
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/summer-school/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          ...data,
          dob: formatDobForApi(data.dob),
          projectSlug: "gca-yungu-summer-school-2026",
          projectType: "milestone_program",
          applicationStatus: "application_submitted",
        }),
      });
      let result: { error?: string } = {};
      try {
        result = (await res.json()) as { error?: string };
      } catch {
        result = {};
      }
      if (!res.ok) {
        setError(result.error ?? (isZh ? "提交失败，请稍后重试。" : "Submission failed. Please try again."));
        return;
      }
      setSubmitted(true);
    } catch {
      setError(isZh ? "网络错误，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabels = isZh
    ? ["基础信息", "气候关切", "AI协作", "愿景", "后勤", "确认提交"]
    : ["Basic Info", "Climate Concern", "AI Collaboration", "Vision", "Logistics", "Confirm & Submit"];

  const stepDescriptions = isZh
    ? [
        "填写你的基本信息与联系方式",
        "分享你的气候关切与探索历程",
        "描述你与 AI 工具的协作方式",
        "分享你的期望与未来计划",
        "确认行程与资助需求",
        "阅读并确认申请承诺",
      ]
    : [
        "Your basic information and contact details",
        "Share your climate concern and exploration journey",
        "Describe your collaboration with AI tools",
        "Your expectations and future plans",
        "Travel and financial aid",
        "Read and confirm your commitments",
      ];

  if (submitted) {
    return (
      <div className="ss-form-card ss-submit-success">
        <div className="success-icon">✓</div>
        <h2>{isZh ? "申请已提交！" : "Application Submitted!"}</h2>
        <p style={{ color: "var(--cp-text-secondary)", maxWidth: "44ch", margin: "12px auto 28px" }}>
          {isZh
            ? "感谢你申请 GCA × 云谷 2026 可持续夏校。我们将在审核后通过邮件通知你进展。"
            : "Thank you for applying to the GCA × Yungu 2026 Sustainability Summer School. We'll notify you by email once your application is reviewed."}
        </p>
        <button
          className="button"
          onClick={() => router.push(`/${locale}/dashboard`)}
          type="button"
        >
          {isZh ? "返回工作台" : "Back to Dashboard"}
        </button>
      </div>
    );
  }

  const countries = isZh ? COUNTRIES_ZH : COUNTRIES_EN;

  return (
    <div className={`ss-layout ${headerRow ? "ss-layout-with-header-row" : ""}`}>
      {/* Sidebar progress */}
      <aside className="ss-sidebar">
        <div className="ss-sidebar-card">
          <span className="label">{isZh ? "申请进度" : "Progress"}</span>
          <div className="ss-progress-list">
            {stepLabels.map((label, i) => {
              const s = i + 1;
              const isDone = s < step;
              const isActive = s === step;
              return (
                <button
                  className={`ss-progress-item ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                  key={label}
                  onClick={() => { if (isDone) setStep(s); }}
                  type="button"
                >
                  <div className="ss-step-dot">{isDone ? "✓" : s}</div>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main form */}
      <div className="ss-main-column">
        {headerRow ? <div className="ss-main-header-row">{headerRow}</div> : null}
        <div className="ss-form-card" ref={formTopRef}>
        <div className="ss-section-header">
          <span className="label">{isZh ? `第 ${step} 步 / ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}</span>
          <h2>{stepLabels[step - 1]}</h2>
          <p>{stepDescriptions[step - 1]}</p>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="form-grid">
            <div className="field-row">
              <div className="field" id="field-fullName">
                <label htmlFor="fullName">
                  <span>{isZh ? "全名（拼音或英文）" : "Full name (romanized)"}<span className="req-star">*</span></span>
                </label>
                <input id="fullName" type="text" value={data.fullName} onChange={handleTextChange("fullName")} aria-required="true" />
                {getFieldError("fullName") && <span className="field-error">{getFieldError("fullName")}</span>}
              </div>
              <div className="field" id="field-preferredName">
                <label htmlFor="preferredName">
                  <span>{isZh ? "偏好称呼" : "Preferred name"}</span>
                </label>
                <input id="preferredName" type="text" value={data.preferredName} onChange={handleTextChange("preferredName")} />
              </div>
            </div>

            <div className="field-row">
              <div className="field" id="field-dob">
                <label htmlFor="dob">
                  <span>{isZh ? "出生日期" : "Date of birth"}<span className="req-star">*</span></span>
                </label>
                <input
                  id="dob"
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday"
                  placeholder="MM/DD/YYYY"
                  value={data.dob}
                  onChange={handleDobChange}
                  aria-required="true"
                  maxLength={10}
                />
                {getFieldError("dob") && <span className="field-error">{getFieldError("dob")}</span>}
              </div>
              <div className="field" id="field-nationality">
                <label htmlFor="nationality">
                  <span>{isZh ? "国籍" : "Nationality"}<span className="req-star">*</span></span>
                </label>
                <select id="nationality" value={data.nationality} onChange={handleTextChange("nationality")} aria-required="true">
                  <option value="">{isZh ? "请选择国籍" : "Select nationality…"}</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {getFieldError("nationality") && <span className="field-error">{getFieldError("nationality")}</span>}
              </div>
            </div>

            <div className="field-row">
              <div className="field" id="field-school">
                <label htmlFor="school">
                  <span>{isZh ? "就读学校" : "School"}<span className="req-star">*</span></span>
                </label>
                <input id="school" type="text" value={data.school} onChange={handleTextChange("school")} aria-required="true" />
                {getFieldError("school") && <span className="field-error">{getFieldError("school")}</span>}
              </div>
              <div className="field" id="field-grade">
                <label htmlFor="grade">
                  <span>{isZh ? "年级" : "Grade"}<span className="req-star">*</span></span>
                </label>
                <select id="grade" value={data.grade} onChange={handleTextChange("grade")} aria-required="true">
                  <option value="">{isZh ? "请选择" : "Select..."}</option>
                  <option>Grade 9</option><option>Grade 10</option><option>Grade 11</option><option>Grade 12</option>
                  <option>Year 10</option><option>Year 11</option><option>Year 12</option><option>Year 13</option>
                  <option>{isZh ? "其他" : "Other"}</option>
                </select>
                {getFieldError("grade") && <span className="field-error">{getFieldError("grade")}</span>}
              </div>
            </div>

            <div className="field-row">
              <div className="field" id="field-email">
                <label htmlFor="email">
                  <span>{isZh ? "申请人邮箱" : "Applicant email"}<span className="req-star">*</span></span>
                </label>
                <input id="email" type="email" value={data.email} onChange={handleTextChange("email")} aria-required="true" />
                {getFieldError("email") && <span className="field-error">{getFieldError("email")}</span>}
              </div>
              <div className="field" id="field-phone">
                <label htmlFor="phone">
                  <span>{isZh ? "申请人手机" : "Applicant phone"}<span className="req-star">*</span></span>
                </label>
                <input id="phone" type="tel" value={data.phone} onChange={handleTextChange("phone")} aria-required="true" />
                {getFieldError("phone") && <span className="field-error">{getFieldError("phone")}</span>}
              </div>
            </div>

            <div className="form-section-head">
              <strong>{isZh ? "监护人信息" : "Guardian information"}</strong>
            </div>

            <div className="field" id="field-guardianName">
              <label htmlFor="guardianName">
                <span>{isZh ? "监护人姓名" : "Guardian name"}<span className="req-star">*</span></span>
              </label>
              <input id="guardianName" type="text" value={data.guardianName} onChange={handleTextChange("guardianName")} aria-required="true" />
              {getFieldError("guardianName") && <span className="field-error">{getFieldError("guardianName")}</span>}
            </div>

            <div className="field-row">
              <div className="field" id="field-guardianEmail">
                <label htmlFor="guardianEmail">
                  <span>{isZh ? "监护人邮箱" : "Guardian email"}<span className="req-star">*</span></span>
                </label>
                <input id="guardianEmail" type="email" value={data.guardianEmail} onChange={handleTextChange("guardianEmail")} aria-required="true" />
                {getFieldError("guardianEmail") && <span className="field-error">{getFieldError("guardianEmail")}</span>}
              </div>
              <div className="field" id="field-guardianPhone">
                <label htmlFor="guardianPhone">
                  <span>{isZh ? "监护人手机" : "Guardian phone"}<span className="req-star">*</span></span>
                </label>
                <input id="guardianPhone" type="tel" value={data.guardianPhone} onChange={handleTextChange("guardianPhone")} aria-required="true" />
                {getFieldError("guardianPhone") && <span className="field-error">{getFieldError("guardianPhone")}</span>}
              </div>
            </div>

            <div className="field" id="field-channel">
              <label htmlFor="channel">
                <span>{isZh ? "了解渠道" : "How did you hear about us?"}</span>
              </label>
              <select id="channel" value={data.channel} onChange={handleTextChange("channel")}>
                <option value="">{isZh ? "请选择" : "Select..."}</option>
                <option value="school">{isZh ? "学校推荐" : "School recommendation"}</option>
                <option value="teacher">{isZh ? "老师推荐" : "Teacher recommendation"}</option>
                <option value="social">{isZh ? "社交媒体" : "Social media"}</option>
                <option value="friend">{isZh ? "朋友推荐" : "Friend recommendation"}</option>
                <option value="gca">{isZh ? "全球气候学院" : "GCA"}</option>
                <option value="scw">{isZh ? "上海气候周" : "SHCW"}</option>
                <option value="other">{isZh ? "其他" : "Other"}</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="form-grid">
            <div className="field" id="field-explorationStage">
              <label>
                <span>{isZh ? "你目前处于哪个气候探索阶段？" : "What stage of climate exploration are you at?"}<span className="req-star">*</span></span>
              </label>
              {getFieldError("explorationStage") && <span className="field-error">{getFieldError("explorationStage")}</span>}
            </div>
            <div className="radio-card-grid">
              {[
                { val: "A", label: isZh ? "A — 刚刚开始关注气候议题" : "A — Just starting to follow climate issues" },
                { val: "B", label: isZh ? "B — 已经在做独立调研或项目" : "B — Already doing independent research or projects" },
                { val: "C", label: isZh ? "C — 已参与气候相关公共实践" : "C — Already engaged in climate-related public practice" },
                { val: "D", label: isZh ? "D — 对特定问题有深度探索" : "D — Have deep focus on a specific issue" },
              ].map(({ val, label }) => (
                <label className={`radio-card ${data.explorationStage === val ? "selected" : ""}`} key={val}>
                  <input checked={data.explorationStage === val} name="explorationStage" onChange={() => setField("explorationStage", val)} type="radio" value={val} />
                  <div className="radio-card-label"><span>{label}</span></div>
                </label>
              ))}
            </div>

            <div className="field" id="field-coreIssue">
              <label htmlFor="coreIssue">
                <span>{isZh ? "你最关心的气候问题是什么？（200–350字）" : "What climate issue do you care about most? (200–350 words)"}<span className="req-star">*</span></span>
              </label>
              <textarea id="coreIssue" value={data.coreIssue} onChange={handleTextChange("coreIssue")} placeholder={isZh ? "请描述你的核心关切，以及你认为造成这一问题的根本原因…" : "Describe your core concern and what you think the root causes are..."} rows={7} aria-required="true" />
              {getFieldError("coreIssue") && <span className="field-error">{getFieldError("coreIssue")}</span>}
            </div>

            <div className="field" id="field-practiceProof">
              <label htmlFor="practiceProof">
                <span>{isZh ? "实践证明（选填）" : "Practice proof (optional)"}</span>
              </label>
              <textarea id="practiceProof" value={data.practiceProof} onChange={handleTextChange("practiceProof")} placeholder={isZh ? "你曾做过哪些与气候相关的项目或行动？" : "Describe any climate-related projects or actions you have taken."} rows={4} />
            </div>

            <div className="field" id="field-portfolioUrl">
              <label htmlFor="portfolioUrl">
                <span>{isZh ? "作品集链接（选填）" : "Portfolio URL (optional)"}</span>
              </label>
              <input id="portfolioUrl" type="url" value={data.portfolioUrl} onChange={handleTextChange("portfolioUrl")} placeholder="https://" />
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="form-grid">
            <div className="field" id="field-aiRole">
              <label>
                <span>{isZh ? "你如何看待 AI 在你学习和研究中的角色？" : "How do you view AI's role in your learning and research?"}<span className="req-star">*</span></span>
              </label>
              {getFieldError("aiRole") && <span className="field-error">{getFieldError("aiRole")}</span>}
            </div>
            <div className="radio-card-grid">
              {[
                { val: "A", strong: isZh ? "积极使用" : "Active user", desc: isZh ? "我经常使用 AI 工具来加速研究和写作，并有清晰的批判性意识。" : "I regularly use AI tools to accelerate research and writing, with critical awareness." },
                { val: "B", strong: isZh ? "谨慎观望" : "Cautious observer", desc: isZh ? "我了解 AI 工具，但还没有系统性地融入我的工作流程。" : "I am aware of AI tools but haven't systematically integrated them into my workflow." },
                { val: "C", strong: isZh ? "深度质疑" : "Critical skeptic", desc: isZh ? "我对 AI 的局限性和风险有深入思考，倾向于保持人工主导。" : "I have deep concerns about AI's limitations and risks, and prefer human-led processes." },
              ].map(({ val, strong, desc }) => (
                <label className={`radio-card ${data.aiRole === val ? "selected" : ""}`} key={val}>
                  <input checked={data.aiRole === val} name="aiRole" onChange={() => setField("aiRole", val)} type="radio" value={val} />
                  <div className="radio-card-label">
                    <strong>{val} — {strong}</strong>
                    <span>{desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {data.aiRole === "A" && (
              <div className="field" id="field-aiTools">
                <label htmlFor="aiTools">
                  <span>{isZh ? "你主要使用哪些 AI 工具？" : "Which AI tools do you mainly use?"}</span>
                </label>
                <input id="aiTools" type="text" value={data.aiTools} onChange={handleTextChange("aiTools")} placeholder={isZh ? "如 ChatGPT、Claude、Gemini、Kimi 等" : "e.g. ChatGPT, Claude, Gemini, Kimi, etc."} />
              </div>
            )}

            <div className="field" id="field-aiBlindspot">
              <label htmlFor="aiBlindspot">
                <span>{isZh ? "你认为 AI 在气候研究中最大的盲区是什么？" : "What do you think is AI's biggest blind spot in climate research?"}<span className="req-star">*</span></span>
              </label>
              <textarea id="aiBlindspot" value={data.aiBlindspot} onChange={handleTextChange("aiBlindspot")} rows={5} placeholder={isZh ? "请分享你的思考…" : "Share your thinking..."} aria-required="true" />
              {getFieldError("aiBlindspot") && <span className="field-error">{getFieldError("aiBlindspot")}</span>}
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="form-grid">
            <div className="field" id="field-expectation">
              <label htmlFor="expectation">
                <span>{isZh ? "你对夏校的期望是什么？" : "What are your expectations for this summer school?"}<span className="req-star">*</span></span>
              </label>
              <textarea id="expectation" value={data.expectation} onChange={handleTextChange("expectation")} rows={6} placeholder={isZh ? "请描述你希望在夏校期间获得什么、学到什么…" : "Describe what you hope to gain or learn during the summer school..."} aria-required="true" />
              {getFieldError("expectation") && <span className="field-error">{getFieldError("expectation")}</span>}
            </div>

            <div className="field" id="field-futurePath">
              <label>
                <span>{isZh ? "毕业后，你希望继续参与哪些项目？（可多选）" : "After graduation, which initiatives do you want to continue? (Multi-select)"}</span>
              </label>
            </div>
            <div className="check-card-grid">
              {[
                { val: "U20", label: isZh ? "U20 青年气候峰会" : "U20 Youth Climate Summit" },
                { val: "SCW", label: isZh ? "上海气候周 (SCW)" : "Shanghai Climate Week (SCW)" },
                { val: "CampusCommunity", label: isZh ? "校园气候社区" : "Campus Climate Community" },
                { val: "Academic", label: isZh ? "学术研究路径" : "Academic research path" },
              ].map(({ val, label }) => (
                <label className={`check-card ${data.futurePath.includes(val) ? "checked" : ""}`} key={val}>
                  <input checked={data.futurePath.includes(val)} onChange={() => toggleFuturePath(val)} type="checkbox" value={val} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div className="form-grid">
            <div className="field" id="field-languageComfort">
              <label htmlFor="languageComfort">
                <span>{isZh ? "课程语言适应度" : "Language comfort level"}<span className="req-star">*</span></span>
              </label>
              <select id="languageComfort" value={data.languageComfort} onChange={handleTextChange("languageComfort")} aria-required="true">
                <option value="">{isZh ? "请选择" : "Select..."}</option>
                <option value="zh-only">{isZh ? "仅中文" : "Chinese only"}</option>
                <option value="en-basic">{isZh ? "基础英语" : "Basic English"}</option>
                <option value="en-fluent">{isZh ? "流利英语" : "Fluent English"}</option>
                <option value="bilingual">{isZh ? "中英双语流利" : "Bilingual (fluent in both)"}</option>
              </select>
              {getFieldError("languageComfort") && <span className="field-error">{getFieldError("languageComfort")}</span>}
            </div>

            <div className="field" id="field-travelCommitment">
              <label htmlFor="travelCommitment">
                <span>{isZh ? "你能否承诺参与全程行程？" : "Can you commit to the full program schedule?"}<span className="req-star">*</span></span>
              </label>
              <select id="travelCommitment" value={data.travelCommitment} onChange={handleTextChange("travelCommitment")} aria-required="true">
                <option value="">{isZh ? "请选择" : "Select..."}</option>
                <option value="yes">{isZh ? "能，我会安排好所有行程" : "Yes, I will arrange everything"}</option>
                <option value="support">{isZh ? "需要组织支持协调" : "I need organizational support"}</option>
                <option value="no">{isZh ? "不能，部分行程有冲突" : "No, I have schedule conflicts"}</option>
              </select>
              {getFieldError("travelCommitment") && <span className="field-error">{getFieldError("travelCommitment")}</span>}
            </div>

            <input type="hidden" id="financialAid" value={data.financialAid} readOnly />
            <input type="hidden" id="financialAidNote" value={data.financialAidNote} readOnly />
          </div>
        )}

        {/* Step 6 */}
        {step === 6 && (
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="panel" style={{ background: "var(--cp-bg-soft)", border: "none" }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--cp-text-secondary)" }}>
                <span style={{ whiteSpace: "pre-line" }}>
                  {isZh
                    ? "提交本申请即表示你已阅读并同意《Climate Passport 隐私政策》及本申请相关个人信息处理说明。相关主办/承办机构及本项目必要的合作方，将在合法、正当、必要和最小化原则下，收集、使用和处理你在申请表中提交的个人信息，仅用于夏校项目申请审核、身份确认、录取与候补管理、项目沟通、证书或 Climate Passport ID 生成、项目组织与安全管理等与本项目直接相关的目的。\n\n除法律法规要求、项目执行所必需，或经你另行明确同意外，我们不会出售你的个人信息，也不会将其用于与本项目无关的商业营销、画像或广告用途。你可根据适用法律法规，申请访问、更正、删除你的个人信息，撤回同意，或就个人信息处理提出咨询与投诉。若申请人为未成年人，应由其父母或法定监护人知情并同意后提交。"
                    : "By submitting this application, you acknowledge that you have read and agreed to the Climate Passport Privacy Policy and this application's personal data processing notice. Relevant host, organizing, and implementation partners, together with other necessary collaborators for this program, will collect, use, and process the personal information submitted in this form under the principles of legality, legitimacy, necessity, and data minimization, solely for purposes directly related to the summer school program, including application review, identity verification, admission and waitlist management, program communication, certificate or Climate Passport ID generation, program operations, and safety management.\n\nUnless required by law, necessary for program execution, or otherwise with your separate and explicit consent, we will not sell your personal information, nor will we use it for unrelated commercial marketing, profiling, or advertising. You may, subject to applicable laws and regulations, request access to, correction of, or deletion of your personal information, withdraw your consent, or raise inquiries and complaints regarding personal data processing. If the applicant is a minor, their parent or legal guardian should be informed and consent before submission."}
                </span>
              </p>
            </div>

            <div className="field" id="field-passportId">
              <label htmlFor="passportId">
                <span>{isZh ? "你的 Climate Passport ID（已有账号填写）" : "Your Climate Passport ID (if you have one)"}</span>
              </label>
              <input id="passportId" type="text" value={data.passportId} onChange={handleTextChange("passportId")} placeholder="K3MV7NP-A4JQHF" className="mono" />
            </div>

            <label className={`radio-card ${confirmationErrorId === "commitment" && !data.commitment ? "error" : ""}`} id="field-commitment" style={{ cursor: "pointer" }}>
              <input checked={data.commitment} onChange={(e) => setField("commitment", e.target.checked)} type="checkbox" />
              <div className="radio-card-label">
                <strong>{isZh ? "承诺认真对待本次申请" : "I commit to this application seriously"}</strong>
                <span>{isZh ? "我理解这是一个竞争性的遴选过程，我保证所提供的所有信息均真实准确。" : "I understand this is a competitive selection process and confirm all information provided is accurate."}</span>
              </div>
            </label>
            {confirmationErrorId === "commitment" && !data.commitment ? <span className="field-error">{confirmationErrorMessage}</span> : null}

            <label className={`radio-card ${confirmationErrorId === "integrity" && !data.integrity ? "error" : ""}`} id="field-integrity" style={{ cursor: "pointer" }}>
              <input checked={data.integrity} onChange={(e) => setField("integrity", e.target.checked)} type="checkbox" />
              <div className="radio-card-label">
                <strong>{isZh ? "学术诚信声明" : "Academic integrity declaration"}</strong>
                <span>{isZh ? "我承诺本申请中的文字内容均为本人原创或已在文中注明 AI 辅助。" : "I confirm the written content in this application is my own or AI assistance has been disclosed."}</span>
              </div>
            </label>
            {confirmationErrorId === "integrity" && !data.integrity ? <span className="field-error">{confirmationErrorMessage}</span> : null}

            <label className={`radio-card ${confirmationErrorId === "passportConsent" && !data.passportConsent ? "error" : ""}`} id="field-passportConsent" style={{ cursor: "pointer" }}>
              <input checked={data.passportConsent} onChange={(e) => setField("passportConsent", e.target.checked)} type="checkbox" />
              <div className="radio-card-label">
                <strong>{isZh ? "同意写入 Climate Passport" : "Consent to Climate Passport record"}</strong>
                <span>{isZh ? "我同意将本次申请的参与记录写入我的 Climate Passport 档案。" : "I consent to having this participation recorded in my Climate Passport."}</span>
              </div>
            </label>
            {confirmationErrorId === "passportConsent" && !data.passportConsent ? <span className="field-error">{confirmationErrorMessage}</span> : null}

            <label className={`radio-card ${confirmationErrorId === "privacyConsent" && !data.privacyConsent ? "error" : ""}`} id="field-privacyConsent" style={{ cursor: "pointer" }}>
              <input checked={data.privacyConsent} onChange={(e) => setField("privacyConsent", e.target.checked)} type="checkbox" />
              <div className="radio-card-label">
                <strong>
                  {isZh ? (
                    <>
                      我已阅读并同意 <Link className="inline-link" href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer">《Climate Passport 隐私政策》</Link> 及本申请相关个人信息处理说明
                    </>
                  ) : (
                    <>
                      I have read and agree to the <Link className="inline-link" href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer">Climate Passport Privacy Policy</Link> and this application's personal data processing notice
                    </>
                  )}
                </strong>
                <span>{isZh ? "如申请人为未成年人，我确认其父母或法定监护人已知情并同意提交本申请。" : "If the applicant is a minor, I confirm their parent or legal guardian is informed and consents to this application."}</span>
              </div>
            </label>
            {confirmationErrorId === "privacyConsent" && !data.privacyConsent ? <span className="field-error">{confirmationErrorMessage}</span> : null}

            {error ? <p className="form-error">{error}</p> : null}

            <div className="button-row">
              <button className="button" disabled={submitting || !data.commitment || !data.integrity || !data.passportConsent || !data.privacyConsent} type="submit">
                {submitting ? (isZh ? "提交中…" : "Submitting…") : (isZh ? "提交申请" : "Submit Application")}
              </button>
            </div>
          </form>
        )}

        {/* Navigation */}
        {step < 6 && (
          <div className="ss-nav-row">
            {step > 1 ? (
              <button className="button-outline" onClick={handlePrev} type="button">{isZh ? "← 上一步" : "← Previous"}</button>
            ) : <div />}
            <button className="button" onClick={handleNext} type="button">{isZh ? "下一步 →" : "Next →"}</button>
          </div>
        )}
        {step === 6 && (
          <div className="ss-nav-row">
            <button className="button-outline" onClick={handlePrev} type="button">{isZh ? "← 上一步" : "← Previous"}</button>
            <div />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
