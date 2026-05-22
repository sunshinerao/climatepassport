"use client";

import { useMemo, useState } from "react";
import type { LearningExperienceApplicationStatus } from "@prisma/client";
import type { Locale } from "@/lib/site-content";

type ProgramCard = {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  location: string | null;
  locationEn: string | null;
  applicationOpenAt: string | null;
  applicationCloseAt: string | null;
  capacity: number | null;
  status: string;
  categoryName: string | null;
  categoryNameEn: string | null;
};

type ApplicationCard = {
  id: string;
  programId: string;
  status: LearningExperienceApplicationStatus;
  submittedAt: string | null;
  updatedAt: string;
  answersJson: unknown;
  program: {
    title: string;
    titleEn: string | null;
    slug: string;
  };
};

const editableStatuses: LearningExperienceApplicationStatus[] = ["DRAFT"];

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

function pickProgramTitle(locale: Locale, program: { title: string; titleEn: string | null }) {
  return locale === "zh" ? program.title : program.titleEn || program.title;
}

export function LearningExperiencesDashboard({
  locale,
  initialPrograms,
  initialApplications,
}: {
  locale: Locale;
  initialPrograms: ProgramCard[];
  initialApplications: ApplicationCard[];
}) {
  const [programs] = useState(initialPrograms);
  const [applications, setApplications] = useState(initialApplications);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>(() => {
    const output: Record<string, string> = {};

    for (const application of initialApplications) {
      if (application.answersJson && typeof application.answersJson === "object") {
        const value = (application.answersJson as { motivation?: unknown }).motivation;
        if (typeof value === "string") {
          output[application.id] = value;
        }
      }
    }

    return output;
  });
  const [pendingProgramId, setPendingProgramId] = useState("");
  const [pendingApplicationId, setPendingApplicationId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applicationMap = useMemo(() => {
    const map = new Map<string, ApplicationCard>();

    for (const application of applications) {
      map.set(application.programId, application);
    }

    return map;
  }, [applications]);

  async function apply(programId: string) {
    setError("");
    setMessage("");
    setPendingProgramId(programId);

    try {
      const response = await fetch("/api/learning-experiences/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programId,
          answersJson: {
            motivation: "",
          },
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        application?: ApplicationCard;
      };

      if (!response.ok || !result.application) {
        setError(result.error ?? (locale === "zh" ? "创建申请失败。" : "Failed to create application."));
        return;
      }

      setApplications((current) => [result.application as ApplicationCard, ...current]);
      setMessage(locale === "zh" ? "申请草稿已创建。" : "Application draft created.");
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setPendingProgramId("");
    }
  }

  async function saveDraft(application: ApplicationCard) {
    const motivation = (draftAnswers[application.id] || "").trim();

    setError("");
    setMessage("");
    setPendingApplicationId(application.id);

    try {
      const response = await fetch(`/api/learning-experiences/applications/${application.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answersJson: {
            motivation,
          },
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        application?: ApplicationCard;
      };

      if (!response.ok || !result.application) {
        setError(result.error ?? (locale === "zh" ? "保存草稿失败。" : "Failed to save draft."));
        return;
      }

      setApplications((current) =>
        current.map((item) => (item.id === application.id ? (result.application as ApplicationCard) : item)),
      );
      setMessage(locale === "zh" ? "草稿已保存。" : "Draft saved.");
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setPendingApplicationId("");
    }
  }

  async function submitApplication(application: ApplicationCard) {
    setError("");
    setMessage("");
    setPendingApplicationId(application.id);

    try {
      const response = await fetch(`/api/learning-experiences/applications/${application.id}/submit`, {
        method: "POST",
      });

      const result = (await response.json()) as {
        error?: string;
        application?: ApplicationCard;
      };

      if (!response.ok || !result.application) {
        setError(result.error ?? (locale === "zh" ? "提交申请失败。" : "Failed to submit application."));
        return;
      }

      setApplications((current) =>
        current.map((item) => (item.id === application.id ? (result.application as ApplicationCard) : item)),
      );
      setMessage(locale === "zh" ? "申请已提交，等待审核。" : "Application submitted and pending review.");
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setPendingApplicationId("");
    }
  }

  return (
    <section className="section two-col admin-layout">
      <div className="panel admin-list-panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">Programs</span>
            <h2>{locale === "zh" ? "可申请项目" : "Open programs"}</h2>
          </div>
        </div>

        <div className="list admin-list">
          {programs.map((program) => {
            const existing = applicationMap.get(program.id);

            return (
              <div className="list-item admin-list-item" key={program.id}>
                <span className="label">{program.status}</span>
                <strong>{locale === "zh" ? program.title : program.titleEn || program.title}</strong>
                <p>{locale === "zh" ? program.summary || "暂无简介" : program.summaryEn || program.summary || "No summary"}</p>
                <div className="footer-note compact-note">
                  {(locale === "zh" ? program.categoryName : program.categoryNameEn || program.categoryName) || "Category"}
                </div>
                <div className="footer-note compact-note">
                  {locale === "zh" ? "申请截止" : "Apply by"}: {formatDate(locale, program.applicationCloseAt)}
                </div>
                <div className="button-row top-gap-sm">
                  <button
                    className="button-secondary"
                    disabled={Boolean(existing) || pendingProgramId === program.id}
                    onClick={() => apply(program.id)}
                    type="button"
                  >
                    {existing
                      ? locale === "zh"
                        ? "已创建申请"
                        : "Application exists"
                      : pendingProgramId === program.id
                        ? locale === "zh"
                          ? "创建中..."
                          : "Creating..."
                        : locale === "zh"
                          ? "创建申请"
                          : "Create application"}
                  </button>
                </div>
              </div>
            );
          })}
          {programs.length === 0 ? (
            <p className="footer-note">{locale === "zh" ? "暂无开放项目。" : "No open programs yet."}</p>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">Applications</span>
            <h2>{locale === "zh" ? "我的申请进度" : "My application lifecycle"}</h2>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

        <div className="list admin-list">
          {applications.map((application) => {
            const editable = editableStatuses.includes(application.status);

            return (
              <div className="list-item admin-list-item" key={application.id}>
                <span className="label">{application.status}</span>
                <strong>{pickProgramTitle(locale, application.program)}</strong>
                <p>
                  {locale === "zh" ? "最后更新" : "Last update"}: {formatDate(locale, application.updatedAt)}
                </p>

                {editable ? (
                  <>
                    <label className="field top-gap-sm">
                      <span>{locale === "zh" ? "申请动机" : "Motivation"}</span>
                      <textarea
                        onChange={(event) =>
                          setDraftAnswers((current) => ({
                            ...current,
                            [application.id]: event.target.value,
                          }))
                        }
                        placeholder={
                          locale === "zh"
                            ? "请简要填写你的参与目标与预期收获。"
                            : "Briefly describe your goals and expected outcomes."
                        }
                        rows={4}
                        value={draftAnswers[application.id] || ""}
                      />
                    </label>

                    <div className="button-row top-gap-sm">
                      <button
                        className="button-secondary"
                        disabled={pendingApplicationId === application.id}
                        onClick={() => saveDraft(application)}
                        type="button"
                      >
                        {locale === "zh" ? "保存草稿" : "Save draft"}
                      </button>
                      <button
                        className="button"
                        disabled={pendingApplicationId === application.id}
                        onClick={() => submitApplication(application)}
                        type="button"
                      >
                        {locale === "zh" ? "提交申请" : "Submit application"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="footer-note compact-note">
                    {application.submittedAt
                      ? `${locale === "zh" ? "提交时间" : "Submitted at"}: ${formatDate(locale, application.submittedAt)}`
                      : locale === "zh"
                        ? "申请状态已锁定，等待下一阶段处理。"
                        : "Application is locked and awaiting next-stage processing."}
                  </p>
                )}
              </div>
            );
          })}

          {applications.length === 0 ? (
            <p className="footer-note">{locale === "zh" ? "你还没有创建申请。" : "You have not created any applications yet."}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
