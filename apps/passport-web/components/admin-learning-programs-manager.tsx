"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { learningProgramStatusOptions } from "@/lib/learning-experiences";
import type { Locale } from "@/lib/site-content";

type ProgramRecord = {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  categoryId: string;
  categoryName: string | null;
  categoryNameEn: string | null;
  managerUserId: string | null;
  managerName: string | null;
  applicationOpenAt: string | null;
  applicationCloseAt: string | null;
  capacity: number | null;
  pointReward: number | null;
  status: string;
  isPublished: boolean;
  applicationCount: number;
  participationCount: number;
};

type CategoryOption = {
  id: string;
  name: string;
  nameEn: string | null;
};

type ManagerOption = {
  id: string;
  name: string;
  role: UserRole;
};

type FormState = {
  slug: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  categoryId: string;
  managerUserId: string;
  applicationOpenAt: string;
  applicationCloseAt: string;
  capacity: string;
  pointReward: string;
  status: (typeof learningProgramStatusOptions)[number];
  isPublished: boolean;
};

function fromProgram(program: ProgramRecord): FormState {
  return {
    slug: program.slug,
    title: program.title,
    titleEn: program.titleEn ?? "",
    summary: program.summary ?? "",
    summaryEn: program.summaryEn ?? "",
    categoryId: program.categoryId,
    managerUserId: program.managerUserId ?? "",
    applicationOpenAt: program.applicationOpenAt ? program.applicationOpenAt.slice(0, 16) : "",
    applicationCloseAt: program.applicationCloseAt ? program.applicationCloseAt.slice(0, 16) : "",
    capacity: program.capacity ? String(program.capacity) : "",
    pointReward: program.pointReward ? String(program.pointReward) : "",
    status: program.status as FormState["status"],
    isPublished: program.isPublished,
  };
}

export function AdminLearningProgramsManager({
  locale,
  userRole,
  initialPrograms,
  categories,
  managers,
}: {
  locale: Locale;
  userRole: UserRole;
  initialPrograms: ProgramRecord[];
  categories: CategoryOption[];
  managers: ManagerOption[];
}) {
  const router = useRouter();
  const [programs, setPrograms] = useState(initialPrograms);
  const [selectedId, setSelectedId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [formState, setFormState] = useState<FormState>({
    slug: "",
    title: "",
    titleEn: "",
    summary: "",
    summaryEn: "",
    categoryId: categories[0]?.id ?? "",
    managerUserId: managers[0]?.id ?? "",
    applicationOpenAt: "",
    applicationCloseAt: "",
    capacity: "",
    pointReward: "",
    status: "DRAFT",
    isPublished: false,
  });

  const isEditing = Boolean(selectedId);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = event.target;
    const value =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;

    setFormState((current) => ({
      ...current,
      [target.name]: value,
    }));
  }

  function startCreate() {
    setSelectedId("");
    setError("");
    setStatusMessage("");
    setFormState({
      slug: "",
      title: "",
      titleEn: "",
      summary: "",
      summaryEn: "",
      categoryId: categories[0]?.id ?? "",
      managerUserId: managers[0]?.id ?? "",
      applicationOpenAt: "",
      applicationCloseAt: "",
      capacity: "",
      pointReward: "",
      status: "DRAFT",
      isPublished: false,
    });
  }

  function startEdit(program: ProgramRecord) {
    setSelectedId(program.id);
    setError("");
    setStatusMessage("");
    setFormState(fromProgram(program));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setStatusMessage("");

    try {
      const payload = {
        ...formState,
        applicationOpenAt: formState.applicationOpenAt
          ? new Date(formState.applicationOpenAt).toISOString()
          : undefined,
        applicationCloseAt: formState.applicationCloseAt
          ? new Date(formState.applicationCloseAt).toISOString()
          : undefined,
        capacity: formState.capacity ? Number(formState.capacity) : undefined,
        pointReward: formState.pointReward ? Number(formState.pointReward) : undefined,
      };

      const response = await fetch(
        isEditing
          ? `/api/admin/learning-experiences/programs/${selectedId}`
          : "/api/admin/learning-experiences/programs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as {
        error?: string;
        program?: ProgramRecord;
      };

      if (!response.ok || !result.program) {
        setError(result.error ?? (locale === "zh" ? "保存失败。" : "Failed to save."));
        return;
      }

      const savedProgram = result.program;

      setPrograms((current) => {
        if (isEditing) {
          return current.map((item) => (item.id === savedProgram.id ? savedProgram : item));
        }

        return [savedProgram, ...current];
      });

      setSelectedId(savedProgram.id);
      setStatusMessage(locale === "zh" ? "项目已保存。" : "Program saved.");
      router.refresh();
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section two-col admin-layout">
      <div className="panel admin-list-panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{locale === "zh" ? "项目清单" : "Programs"}</span>
            <h2>{locale === "zh" ? "Learning Experiences" : "Learning Experiences"}</h2>
          </div>
          <button className="button-secondary" onClick={startCreate} type="button">
            {locale === "zh" ? "新建项目" : "New program"}
          </button>
        </div>

        <div className="list admin-list">
          {programs.map((program) => (
            <button
              className="list-item admin-list-item"
              key={program.id}
              onClick={() => startEdit(program)}
              type="button"
            >
              <span className="label">{program.status}</span>
              <strong>{locale === "zh" ? program.title : program.titleEn || program.title}</strong>
              <p>{program.categoryName || program.categoryNameEn || "Category"}</p>
              <div className="footer-note compact-note">
                {program.applicationCount} {locale === "zh" ? "申请" : "applications"} · {program.participationCount}{" "}
                {locale === "zh" ? "参与" : "participants"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">
              {isEditing ? (locale === "zh" ? "编辑模式" : "Editing") : locale === "zh" ? "创建模式" : "Create"}
            </span>
            <h2>{locale === "zh" ? "项目配置" : "Program configuration"}</h2>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="split">
            <label className="field">
              <span>Slug</span>
              <input name="slug" onChange={updateField} required type="text" value={formState.slug} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "状态" : "Status"}</span>
              <select name="status" onChange={updateField} value={formState.status}>
                {learningProgramStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "中文标题" : "Chinese title"}</span>
              <input name="title" onChange={updateField} required type="text" value={formState.title} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "英文标题" : "English title"}</span>
              <input name="titleEn" onChange={updateField} type="text" value={formState.titleEn} />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "项目类别" : "Category"}</span>
              <select name="categoryId" onChange={updateField} value={formState.categoryId}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {locale === "zh" ? category.name : category.nameEn || category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{locale === "zh" ? "负责人" : "Manager"}</span>
              <select
                disabled={userRole === "EVENT_MANAGER"}
                name="managerUserId"
                onChange={updateField}
                value={formState.managerUserId}
              >
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} ({manager.role})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>{locale === "zh" ? "中文简介" : "Chinese summary"}</span>
            <textarea name="summary" onChange={updateField} rows={3} value={formState.summary} />
          </label>
          <label className="field">
            <span>{locale === "zh" ? "英文简介" : "English summary"}</span>
            <textarea name="summaryEn" onChange={updateField} rows={3} value={formState.summaryEn} />
          </label>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "申请开始" : "Application opens"}</span>
              <input name="applicationOpenAt" onChange={updateField} type="datetime-local" value={formState.applicationOpenAt} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "申请截止" : "Application closes"}</span>
              <input
                name="applicationCloseAt"
                onChange={updateField}
                type="datetime-local"
                value={formState.applicationCloseAt}
              />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "容量" : "Capacity"}</span>
              <input name="capacity" onChange={updateField} type="number" value={formState.capacity} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "积分奖励" : "Point reward"}</span>
              <input name="pointReward" onChange={updateField} type="number" value={formState.pointReward} />
            </label>
          </div>

          <label className="toggle-field">
            <input checked={formState.isPublished} name="isPublished" onChange={updateField} type="checkbox" />
            <span>{locale === "zh" ? "公开发布" : "Published"}</span>
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {statusMessage ? <p className="form-success">{statusMessage}</p> : null}

          <div className="button-row">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "..." : locale === "zh" ? "保存项目" : "Save program"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
