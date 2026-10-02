"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/site-content";
import { beginGovernanceProjectSwitch, canSubmitGovernanceCommand } from "@/lib/server/governance-workbench-state";
import styles from "./governance-workbench.module.css";

type ProjectSummary = {
  id: string;
  code: string;
  programmeId: string;
  programmeName: string;
  institutionName: string;
  activityId: string | null;
  kind: string;
  title: string;
  status: string;
  accessRole: string | null;
  canManage: boolean;
};

type Rule = {
  id: string;
  version: number;
  status: string;
  validFrom: string;
  validUntil: string;
  conditionJson: unknown;
  rewardsJson: unknown;
};

type RewardTask = {
  id: string;
  state: string;
  operation: string;
  type: string;
  points: number;
  attempts: number;
  failureCode: string | null;
  factId: string;
  nextAttemptAt: string;
};

type ProjectDetail = {
  project: { id: string; code: string; title: string; kind: string; status: string };
  rules: Rule[];
  sources: Array<{ id: string; sourceApp: string; externalUnitId: string }>;
  tasks: RewardTask[];
};

function text(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

async function readResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.code === "string" ? body.code : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return body;
}

function statusClass(status: string) {
  if (["PUBLISHED", "SUCCEEDED", "ACTIVE"].includes(status)) return styles.statusSuccess;
  if (["RETRY", "BLOCKED", "RECONCILIATION_PENDING"].includes(status)) return styles.statusWarning;
  if (["RETIRED", "CANCELLED", "REVERSED"].includes(status)) return styles.statusMuted;
  return styles.statusNeutral;
}

export function GovernanceWorkbench({ locale }: { locale: Locale }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedProjectIdRef = useRef("");
  const detailProjectIdRef = useRef<string | null>(null);
  const loadingDetailRef = useRef(false);

  function selectProject(projectId: string) {
    const next = beginGovernanceProjectSwitch(projectId);
    selectedProjectIdRef.current = next.selectedProjectId;
    detailProjectIdRef.current = null;
    loadingDetailRef.current = next.loadingDetail;
    setSelectedProjectId(next.selectedProjectId);
    setDetail(next.detail);
    setLoadingDetail(next.loadingDetail);
    setBusyKey(null);
    setError(null);
    setMessage(null);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/governance", { cache: "no-store" })
      .then(readResponse)
      .then((body) => {
        if (!active) return;
        const rows = Array.isArray(body.projects) ? (body.projects as ProjectSummary[]) : [];
        setProjects(rows);
        selectProject(rows[0]?.id ?? "");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) setLoadingProjects(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      detailProjectIdRef.current = null;
      loadingDetailRef.current = false;
      setDetail(null);
      setLoadingDetail(false);
      return;
    }
    const requestProjectId = selectedProjectId;
    const controller = new AbortController();
    loadingDetailRef.current = true;
    setLoadingDetail(true);
    setError(null);
    fetch(`/api/governance?projectId=${encodeURIComponent(requestProjectId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readResponse)
      .then((body) => {
        const nextDetail = body as unknown as ProjectDetail;
        if (selectedProjectIdRef.current !== requestProjectId || nextDetail.project.id !== requestProjectId) return;
        detailProjectIdRef.current = nextDetail.project.id;
        setDetail(nextDetail);
      })
      .catch((cause) => {
        if (!controller.signal.aborted && selectedProjectIdRef.current === requestProjectId) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && selectedProjectIdRef.current === requestProjectId) {
          loadingDetailRef.current = false;
          setLoadingDetail(false);
        }
      });
    return () => controller.abort();
  }, [selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const currentDetail = detail?.project.id === selectedProjectId ? detail : null;

  async function runCommand(key: string, projectId: string, command: Record<string, unknown>) {
    const commandProjectId = typeof command.projectId === "string" ? command.projectId : null;
    if (!canSubmitGovernanceCommand({
      selectedProjectId: selectedProjectIdRef.current,
      requestedProjectId: projectId,
      commandProjectId,
      detailProjectId: detailProjectIdRef.current,
      loadingDetail: loadingDetailRef.current,
    })) return;

    const busyToken = `${projectId}:${key}`;
    setBusyKey(busyToken);
    setError(null);
    setMessage(null);
    try {
      const result = await readResponse(await fetch("/api/governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      }));
      if (selectedProjectIdRef.current !== projectId) return;
      const state = typeof result.state === "string" ? result.state : "APPLIED";
      const rewardSuccess = result.rewardSuccess === true;
      setMessage(text(locale, `操作已记录：${state}${rewardSuccess ? " · 奖励已完成" : ""}`, `Operation recorded: ${state}${rewardSuccess ? " · reward completed" : ""}`));
      const response = await fetch(`/api/governance?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const nextDetail = (await readResponse(response)) as unknown as ProjectDetail;
      if (selectedProjectIdRef.current === projectId && nextDetail.project.id === projectId) {
        detailProjectIdRef.current = projectId;
        setDetail(nextDetail);
      }
    } catch (cause) {
      if (selectedProjectIdRef.current === projectId) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setBusyKey((current) => current === busyToken ? null : current);
    }
  }

  function transitionButton(target: { id?: string; status: string }, projectId: string, ruleVersionId?: string) {
    const transition = target.status === "DRAFT"
      ? "approve"
      : target.status === "APPROVED"
        ? "publish"
        : target.status === "PUBLISHED"
          ? "retire"
          : null;
    if (!transition || !selectedProject?.canManage || !currentDetail || currentDetail.project.id !== projectId) return null;
    const key = `transition:${target.id ?? projectId}:${transition}`;
    const label = transition === "approve"
      ? text(locale, "批准", "Approve")
      : transition === "publish"
        ? text(locale, "发布", "Publish")
        : text(locale, "退役", "Retire");
    return (
      <button
        className={styles.actionButton}
        disabled={loadingDetail || busyKey !== null}
        key={key}
        onClick={() => void runCommand(key, projectId, {
          action: "transition",
          projectId,
          ...(ruleVersionId ? { ruleVersionId } : {}),
          transition,
        })}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{text(locale, "Programme 治理", "Programme governance")}</p>
          <h1>{text(locale, "治理工作台", "Governance workspace")}</h1>
        </div>
        <span className={styles.scopeNote}>{text(locale, "按当前 Programme 授权显示", "Scoped to your current Programme access")}</span>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}

      {loadingProjects ? (
        <p className={styles.empty}>{text(locale, "正在读取授权项目…", "Loading authorized projects…")}</p>
      ) : projects.length === 0 ? (
        <p className={styles.empty}>{text(locale, "没有可读取的治理项目。", "No governance projects are available to your account.")}</p>
      ) : (
        <>
          <div className={styles.projectPicker}>
            <label htmlFor="governance-project">{text(locale, "治理项目", "Governance project")}</label>
            <select id="governance-project" value={selectedProjectId} onChange={(event) => selectProject(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} · {project.programmeName} · {project.code}
                </option>
              ))}
            </select>
            {selectedProject ? <span className={`${styles.status} ${statusClass(selectedProject.status)}`}>{selectedProject.status}</span> : null}
          </div>

          {selectedProject ? (
            <>
              <section className={styles.summary} aria-label={text(locale, "项目摘要", "Project summary")}>
                <div><span>{text(locale, "机构", "Institution")}</span><strong>{selectedProject.institutionName}</strong></div>
                <div><span>{text(locale, "项目类型", "Unit type")}</span><strong>{selectedProject.kind}</strong></div>
                <div><span>{text(locale, "你的范围角色", "Your scope role")}</span><strong>{selectedProject.accessRole ?? text(locale, "只读授权", "Read access")}</strong></div>
                <div><span>{text(locale, "管理操作", "Management actions")}</span><strong>{selectedProject.canManage ? text(locale, "可用", "Available") : text(locale, "只读", "Read only")}</strong></div>
              </section>

              {selectedProject.canManage ? (
                <section className={styles.lifecycle} aria-label={text(locale, "项目生命周期", "Project lifecycle")}>
                  <h2>{text(locale, "项目生命周期", "Project lifecycle")}</h2>
                  <span className={`${styles.status} ${statusClass(currentDetail?.project.status ?? selectedProject.status)}`}>{currentDetail?.project.status ?? selectedProject.status}</span>
                  {currentDetail ? transitionButton({ id: currentDetail.project.id, status: currentDetail.project.status }, currentDetail.project.id) : null}
                </section>
              ) : null}

              {loadingDetail ? <p className={styles.empty}>{text(locale, "正在读取项目详情…", "Loading project details…")}</p> : null}
              {currentDetail && !loadingDetail ? (
                <>
                  <section className={styles.section}>
                    <div className={styles.sectionHeading}>
                      <h2>{text(locale, "奖励规则版本", "Reward rule versions")}</h2>
                      <span>{currentDetail.rules.length}</span>
                    </div>
                    {currentDetail.rules.length ? (
                      <div className={styles.tableWrap}>
                        <table>
                          <thead><tr><th>{text(locale, "版本", "Version")}</th><th>{text(locale, "条件", "Condition")}</th><th>{text(locale, "奖励", "Rewards")}</th><th>{text(locale, "有效期", "Validity")}</th><th>{text(locale, "状态", "Status")}</th><th>{text(locale, "操作", "Actions")}</th></tr></thead>
                          <tbody>{currentDetail.rules.map((rule) => (
                            <tr key={rule.id}>
                              <td>v{rule.version}</td>
                              <td><code>{JSON.stringify(rule.conditionJson)}</code></td>
                              <td><code>{JSON.stringify(rule.rewardsJson)}</code></td>
                              <td>{new Date(rule.validFrom).toLocaleDateString(locale)} – {new Date(rule.validUntil).toLocaleDateString(locale)}</td>
                              <td><span className={`${styles.status} ${statusClass(rule.status)}`}>{rule.status}</span></td>
                              <td>{transitionButton({ id: rule.id, status: rule.status }, currentDetail.project.id, rule.id)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ) : <p className={styles.empty}>{text(locale, "尚无规则版本", "No rule versions")}</p>}
                  </section>

                  <section className={styles.section}>
                    <div className={styles.sectionHeading}>
                      <h2>{text(locale, "来源", "Sources")}</h2>
                      <span>{currentDetail.sources.length}</span>
                    </div>
                    {currentDetail.sources.length ? (
                      <ul className={styles.sourceList}>{currentDetail.sources.map((source) => (
                        <li key={source.id}><strong>{source.sourceApp.toUpperCase()}</strong><span>{source.externalUnitId}</span><code>{source.id}</code></li>
                      ))}</ul>
                    ) : <p className={styles.empty}>{text(locale, "尚无来源登记", "No source mappings")}</p>}
                  </section>

                  <section className={styles.section}>
                    <div className={styles.sectionHeading}>
                      <h2>{text(locale, "奖励与冲正任务", "Reward and reversal tasks")}</h2>
                      <span>{currentDetail.tasks.length}</span>
                    </div>
                    {currentDetail.tasks.length ? (
                      <div className={styles.tableWrap}>
                        <table>
                          <thead><tr><th>{text(locale, "类型", "Type")}</th><th>{text(locale, "事实", "Fact")}</th><th>{text(locale, "积分", "Points")}</th><th>{text(locale, "尝试", "Attempts")}</th><th>{text(locale, "状态", "State")}</th><th>{text(locale, "操作", "Actions")}</th></tr></thead>
                          <tbody>{currentDetail.tasks.map((task) => {
                            const canProcess = selectedProject.canManage && task.state === "PENDING" && Date.parse(task.nextAttemptAt) <= Date.now();
                            const canRetry = selectedProject.canManage && ["RETRY", "BLOCKED"].includes(task.state);
                            return (
                              <tr key={task.id}>
                                <td>{task.operation} · {task.type}</td>
                                <td><code>{task.factId}</code></td>
                                <td>{task.points}</td>
                                <td>{task.attempts}</td>
                                <td><span className={`${styles.status} ${statusClass(task.state)}`}>{task.state}</span>{task.failureCode ? <small className={styles.failure}>{task.failureCode}</small> : null}</td>
                                <td className={styles.actions}>
                                  {canProcess ? <button className={styles.actionButton} disabled={loadingDetail || busyKey !== null} onClick={() => void runCommand(`process:${task.id}`, currentDetail.project.id, { action: "process", projectId: currentDetail.project.id, taskId: task.id })} type="button">{text(locale, "处理", "Process")}</button> : null}
                                  {canRetry ? <button className={styles.actionButton} disabled={loadingDetail || busyKey !== null} onClick={() => void runCommand(`retry:${task.id}`, currentDetail.project.id, { action: "retry", projectId: currentDetail.project.id, taskId: task.id })} type="button">{text(locale, "重试", "Retry")}</button> : null}
                                </td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    ) : <p className={styles.empty}>{text(locale, "暂无奖励任务", "No reward tasks")}</p>}
                  </section>
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}