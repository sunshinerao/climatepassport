"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  activityId: string;
  activityTitle: string;
  requiresApproval: boolean;
  formTemplate: { fieldsJson: unknown } | null;
  locale: string;
  userId: string;
}

export default function ActivityApplyClient({ activityId, activityTitle, requiresApproval, formTemplate, locale, userId }: Props) {
  const zh = locale === "zh";
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/activity-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          userId,
          status: "SUBMITTED",
          formResponseJson: note ? { note } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (zh ? "提交失败，请稍后重试" : "Submission failed. Please try again."));
        return;
      }
      // Success — redirect to activity detail page
      router.push(`/${locale}/activities/${encodeURIComponent(data.application?.activityId ?? activityId)}`);
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
