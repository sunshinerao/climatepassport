"use client";

import { useMemo, useState } from "react";
import { learningApplicationStatusOptions } from "@/lib/learning-experiences";
import type { Locale } from "@/lib/site-content";

type StageRecord = {
  id: string;
  key: string;
  name: string;
  nameEn: string | null;
  order: number;
};

type ApplicationRecord = {
  id: string;
  status: (typeof learningApplicationStatusOptions)[number];
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  decidedAt: string | null;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  program: {
    id: string;
    slug: string;
    title: string;
    titleEn: string | null;
    stages: StageRecord[];
  };
  currentStage: StageRecord | null;
  participation: {
    id: string;
    status: string;
    completionPercent: number;
    pointsAwarded: number | null;
  } | null;
};

function pickProgramTitle(locale: Locale, program: { title: string; titleEn: string | null }) {
  return locale === "zh" ? program.title : program.titleEn || program.title;
}

function formatDate(locale: Locale, value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminLearningApplicationsManager({
  initialApplications,
  locale,
}: {
  initialApplications: ApplicationRecord[];
  locale: Locale;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [statusFilter, setStatusFilter] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(() => {
    const output: Record<string, string> = {};

    for (const item of initialApplications) {
      if (item.reviewNotes) {
        output[item.id] = item.reviewNotes;
      }
    }

    return output;
  });
  const [draftStageKeys, setDraftStageKeys] = useState<Record<string, string>>(() => {
    const output: Record<string, string> = {};

    for (const item of initialApplications) {
      output[item.id] = item.currentStage?.key || "";
    }

    return output;
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const visibleApplications = useMemo(() => {
    if (!statusFilter) {
      return applications;
    }

    return applications.filter((item) => item.status === statusFilter);
  }, [applications, statusFilter]);

  async function applyStatus(
    application: ApplicationRecord,
    nextStatus: (typeof learningApplicationStatusOptions)[number],
  ) {
    setError("");
    setMessage("");
    setPendingId(application.id);

    try {
      const response = await fetch(`/api/admin/learning-experiences/applications/${application.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          reviewNotes: draftNotes[application.id] || "",
          stageKey: draftStageKeys[application.id] || undefined,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        application?: ApplicationRecord;
      };

      if (!response.ok || !result.application) {
        setError(result.error ?? (locale === "zh" ? "更新状态失败。" : "Failed to update status."));
        return;
      }

      const updated = result.application;

      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDraftNotes((current) => ({
        ...current,
        [updated.id]: updated.reviewNotes || "",
      }));
      setDraftStageKeys((current) => ({
        ...current,
        [updated.id]: updated.currentStage?.key || "",
      }));
      setMessage(locale === "zh" ? "状态已更新。" : "Status updated.");
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <section className="section">
      <div className="panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">Applications</span>
            <h2>{locale === "zh" ? "申请审核闭环" : "Application review lifecycle"}</h2>
          </div>
          <div>
            <select
              className="status-select"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">{locale === "zh" ? "全部状态" : "All statuses"}</option>
              {learningApplicationStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

        <div className="list admin-list">
          {visibleApplications.map((application) => (
            <div className="list-item admin-list-item" key={application.id}>
              <span className="label">{application.status}</span>
              <strong>{pickProgramTitle(locale, application.program)} · {application.user.name}</strong>
              <p>{application.user.email}</p>
              <div className="footer-note compact-note">
                {locale === "zh" ? "提交" : "Submitted"}: {formatDate(locale, application.submittedAt)}
              </div>
              <div className="footer-note compact-note">
                {locale === "zh" ? "当前阶段" : "Current stage"}: {application.currentStage ? (locale === "zh" ? application.currentStage.name : application.currentStage.nameEn || application.currentStage.name) : "-"}
              </div>

              <label className="field top-gap-sm">
                <span>{locale === "zh" ? "审核备注" : "Review notes"}</span>
                <textarea
                  onChange={(event) =>
                    setDraftNotes((current) => ({
                      ...current,
                      [application.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  value={draftNotes[application.id] || ""}
                />
              </label>

              <div className="split top-gap-sm">
                <label className="field">
                  <span>{locale === "zh" ? "阶段" : "Stage"}</span>
                  <select
                    onChange={(event) =>
                      setDraftStageKeys((current) => ({
                        ...current,
                        [application.id]: event.target.value,
                      }))
                    }
                    value={draftStageKeys[application.id] || ""}
                  >
                    <option value="">{locale === "zh" ? "保持当前阶段" : "Keep current"}</option>
                    {application.program.stages.map((stage) => (
                      <option key={stage.id} value={stage.key}>
                        {locale === "zh" ? stage.name : stage.nameEn || stage.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{locale === "zh" ? "更新状态" : "Next status"}</span>
                  <select
                    disabled={pendingId === application.id}
                    onChange={(event) => {
                      const nextStatus = event.target.value as (typeof learningApplicationStatusOptions)[number];
                      if (!nextStatus || nextStatus === application.status) {
                        return;
                      }
                      void applyStatus(application, nextStatus);
                    }}
                    value={application.status}
                  >
                    {learningApplicationStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {application.participation ? (
                <div className="footer-note compact-note top-gap-sm">
                  Participation: {application.participation.status} · {application.participation.completionPercent}%
                </div>
              ) : null}
            </div>
          ))}

          {visibleApplications.length === 0 ? (
            <p className="footer-note">{locale === "zh" ? "暂无申请记录。" : "No applications found."}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
