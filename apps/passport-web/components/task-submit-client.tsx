"use client";

import { useState } from "react";

interface Props {
  activityId: string;
  taskId: string;
  taskType: string;
  requiresSubmission: boolean;
  requiresCheckin: boolean;
  locale: string;
  userId: string;
  hasExistingSubmission: boolean;
}

export default function TaskSubmitClient({ activityId, taskId, taskType, requiresSubmission, requiresCheckin, locale, userId, hasExistingSubmission }: Props) {
  const zh = locale === "zh";
  const [textContent, setTextContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);

  async function handleCheckin() {
    setCheckinLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/activity-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, taskId, userId, method: "MANUAL" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (zh ? "签到失败" : "Checkin failed"));
        return;
      }
      setCheckinDone(true);
    } catch {
      setError(zh ? "网络错误" : "Network error");
    } finally {
      setCheckinLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textContent && !linkUrl) {
      setError(zh ? "请填写提交内容" : "Please add some content before submitting");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/activity-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          taskId,
          userId,
          textContent: textContent || null,
          linkUrl: linkUrl || null,
          status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (zh ? "提交失败" : "Submission failed"));
        return;
      }
      setSuccess(true);
    } catch {
      setError(zh ? "网络错误" : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div >
      {requiresCheckin && (
        <div className="section">
          <h3>{zh ? "任务签到" : "Task Check-in"}</h3>
          {checkinDone ? (
            <div className="form-error form-success">{zh ? "✓ 已成功签到" : "✓ Checked in successfully"}</div>
          ) : (
            <button
              className="button button"
              disabled={checkinLoading}
              type="button"
              onClick={handleCheckin}
            >
              {checkinLoading ? (zh ? "签到中..." : "Checking in...") : (zh ? "立即签到" : "Check In")}
            </button>
          )}
        </div>
      )}

      {requiresSubmission && !success && !hasExistingSubmission && (
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-grid">
            <legend className="label">{zh ? "提交成果" : "Submit Work"}</legend>

            {(taskType === "REFLECTION" || taskType === "SURVEY" || taskType === "LEARNING_UNIT") && (
              <div className="field">
                <label className="label" htmlFor="task-text">
                  {zh ? "文字内容" : "Text Content"}
                </label>
                <textarea
                  className="field"
                  id="task-text"
                  maxLength={5000}
                  placeholder={zh ? "请输入你的反思/回答..." : "Enter your reflection or answer..."}
                  rows={6}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
              </div>
            )}

            {(taskType === "SHARE" || taskType === "UPLOAD") && (
              <div className="field">
                <label className="label" htmlFor="task-link">
                  {zh ? "链接或作品地址" : "Link or Work URL"}
                </label>
                <input
                  className="field"
                  id="task-link"
                  placeholder="https://"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
            )}

            {!taskType.match(/REFLECTION|SURVEY|LEARNING_UNIT|SHARE|UPLOAD/) && (
              <div className="field">
                <label className="label" htmlFor="task-text-gen">
                  {zh ? "提交内容" : "Submission Content"}
                </label>
                <textarea
                  className="field"
                  id="task-text-gen"
                  maxLength={5000}
                  rows={4}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
              </div>
            )}

            {error && <div className="form-error form-error">{error}</div>}

            <div className="button-row">
              <button className="button button" disabled={submitting} type="submit">
                {submitting ? (zh ? "提交中..." : "Submitting...") : (zh ? "提交成果" : "Submit Work")}
              </button>
            </div>
          </div>
        </form>
      )}

      {(success || hasExistingSubmission) && !error && (
        <div className="form-error form-success">
          {zh ? "✓ 已提交，等待审核" : "✓ Submitted — awaiting review"}
        </div>
      )}

      {error && !requiresCheckin && <div className="form-error form-error">{error}</div>}
    </div>
  );
}
