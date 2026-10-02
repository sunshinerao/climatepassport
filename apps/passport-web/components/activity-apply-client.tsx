"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  activityId: string;
  activitySlug: string;
  activityTitle: string;
  requiresApproval: boolean;
  formTemplate: { fieldsJson: unknown } | null;
  locale: string;
  userId: string;
  activityType: string;
}

export default function ActivityApplyClient({ activityId, activitySlug, activityTitle, requiresApproval, formTemplate, locale, userId, activityType }: Props) {
  const zh = locale === "zh";
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState({ shareName: false, shareEmail: false, shareTitle: false, shareBio: false, shareAffiliations: false, sharePortfolioLink: false });
  const [portfolioShareLinkId, setPortfolioShareLinkId] = useState("");
  const isProject = activityType === "PROJECT";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    if (isProject && !Object.values(consent).some(Boolean)) {
      setError(zh ? "请至少明确同意分享一项资料。" : "Explicitly consent to share at least one field.");
      setSubmitting(false);
      return;
    }
    if (isProject && consent.sharePortfolioLink && !portfolioShareLinkId) {
      setError(zh ? "请选择有效的作品集分享链接。" : "Select an active portfolio share link.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/activity-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          userId,
          status: "SUBMITTED",
          formResponseJson: note ? { note } : null,
          ...(isProject ? { consent: { policyVersion: "PROJECT_APPLICATION_CONSENT_V1", ...consent, portfolioShareLinkId: portfolioShareLinkId || null, purposeSnapshot: zh ? "用于项目申请审核" : "For project application review" } } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (zh ? "提交失败，请稍后重试" : "Submission failed. Please try again."));
        return;
      }
      // Success — redirect to activity detail page (routed by slug, not id)
      router.push(`/${locale}/activities/${encodeURIComponent(activitySlug)}`);
      router.refresh();
    } catch {
      setError(zh ? "网络错误，请稍后重试" : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-grid">
        <legend className="label">
          {zh ? `申请参与：${activityTitle}` : `Apply for: ${activityTitle}`}
        </legend>

        {requiresApproval && (
          <div className="field">
            <label className="label" htmlFor="apply-note">
              {zh ? "申请说明（可选）" : "Application Note (optional)"}
            </label>
            <textarea
              className="field"
              id="apply-note"
              maxLength={1000}
              placeholder={zh ? "请简要介绍您参与本活动的动机..." : "Briefly describe your motivation for participating..."}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}

        {isProject && (
          <fieldset className="form-grid">
            <legend className="label">{zh ? "项目申请资料分享同意" : "Project application sharing consent"}</legend>
            <p className="brand-subtitle">{zh ? "仅向项目负责人或管理员用于审核。可逐项选择；不会公开展示申请人资料。" : "Only project owners or administrators may use these fields for review. Nothing is publicly listed."}</p>
            {(["shareName", "shareEmail", "shareTitle", "shareBio", "shareAffiliations"] as const).map((field) => (
              <label key={field} className="label"><input type="checkbox" checked={consent[field]} onChange={(e) => setConsent((v) => ({ ...v, [field]: e.target.checked }))} /> {({ shareName: zh ? "姓名" : "Name", shareEmail: zh ? "邮箱" : "Email", shareTitle: zh ? "职务" : "Title", shareBio: zh ? "简介" : "Bio", shareAffiliations: zh ? "所属机构" : "Affiliations" } as Record<string, string>)[field]}</label>
            ))}
            <label className="label"><input type="checkbox" checked={consent.sharePortfolioLink} onChange={(e) => setConsent((v) => ({ ...v, sharePortfolioLink: e.target.checked }))} /> {zh ? "作品集分享链接" : "Portfolio share link"}</label>
            {consent.sharePortfolioLink && <input className="field" value={portfolioShareLinkId} onChange={(e) => setPortfolioShareLinkId(e.target.value)} placeholder={zh ? "输入您有效分享链接的 ID" : "Enter your active share link ID"} />}
          </fieldset>
        )}

        {error && <div className="form-error form-error">{error}</div>}

        <div className="button-row">
          <button className="button button" disabled={submitting} type="submit">
            {submitting
              ? (zh ? "提交中..." : "Submitting...")
              : requiresApproval
                ? (zh ? "提交申请" : "Submit Application")
                : (zh ? "立即报名" : "Register Now")}
          </button>
        </div>
      </div>
    </form>
  );
}
