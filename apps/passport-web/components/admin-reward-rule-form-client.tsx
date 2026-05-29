"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TRIGGERS = [
  { value: "REGISTRATION_APPROVED", zh: "报名审核通过", en: "Registration Approved" },
  { value: "CHECKIN_COMPLETED",     zh: "签到完成",     en: "Check-in Completed" },
  { value: "TASK_COMPLETED",        zh: "任务完成",     en: "Task Completed" },
  { value: "CONSECUTIVE_CHECKIN",   zh: "连续签到",     en: "Consecutive Check-in" },
  { value: "SUBMISSION_APPROVED",   zh: "成果审核通过", en: "Submission Approved" },
  { value: "COURSE_COMPLETED",      zh: "课程完成",     en: "Course Completed" },
  { value: "PROJECT_COMPLETED",     zh: "项目完成",     en: "Project Completed" },
  { value: "EXCELLENT_REVIEW",      zh: "优秀评审",     en: "Excellent Review" },
  { value: "ROLE_ASSIGNED",         zh: "角色分配",     en: "Role Assigned" },
  { value: "REFERRAL_SUCCESS",      zh: "成功推荐",     en: "Referral Success" },
  { value: "PARTICIPATION_COMPLETED", zh: "参与完成",   en: "Participation Completed" },
];

const REWARD_TYPES = [
  { value: "POINTS",        zh: "积分",     en: "Points",        hint: '{"points":100}' },
  { value: "BADGE",         zh: "徽章",     en: "Badge",         hint: '{"badgeDefinitionId":"uuid"}' },
  { value: "CERTIFICATE",   zh: "证书",     en: "Certificate",   hint: '{"certificateDefinitionId":"uuid"}' },
  { value: "PASSPORT_ENTRY",zh: "护照记录", en: "Passport Entry",hint: '{}' },
  { value: "SKILL_TAG",     zh: "技能标签", en: "Skill Tag",     hint: '{"skillTags":["climate_action"]}' },
  { value: "NOTIFICATION",  zh: "通知",     en: "Notification",  hint: '{"message":"Congratulations!"}' },
];

interface Props {
  activityId: string;
  locale: string;
  onCreated?: () => void;
}

export default function AdminRewardRuleFormClient({ activityId, locale, onCreated }: Props) {
  const zh = locale === "zh";
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("REGISTRATION_APPROVED");
  const [rewardType, setRewardType] = useState("POINTS");
  const [points, setPoints] = useState("50");
  const [rewardValueRaw, setRewardValueRaw] = useState('{"points":50}');
  const [streakRequired, setStreakRequired] = useState("7");
  const [conditionRaw, setConditionRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConsecutiveCheckin = trigger === "CONSECUTIVE_CHECKIN";
  const isPoints = rewardType === "POINTS";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let rewardValueJson: unknown;
    try {
      if (isPoints) {
        const pts = parseInt(points, 10);
        if (isNaN(pts) || pts <= 0) throw new Error(zh ? "积分必须是正整数" : "Points must be a positive integer");
        rewardValueJson = { points: pts };
      } else {
        rewardValueJson = JSON.parse(rewardValueRaw);
      }
    } catch (err) {
      setError((err as Error).message || (zh ? "奖励值 JSON 格式错误" : "Invalid reward value JSON"));
      return;
    }

    let conditionJson: unknown = undefined;
    try {
      if (isConsecutiveCheckin) {
        const streak = parseInt(streakRequired, 10);
        if (isNaN(streak) || streak < 2) throw new Error(zh ? "连续天数至少为 2" : "Streak must be at least 2");
        conditionJson = { streakRequired: streak };
      } else if (conditionRaw.trim()) {
        conditionJson = JSON.parse(conditionRaw);
      }
    } catch (err) {
      setError((err as Error).message || (zh ? "条件 JSON 格式错误" : "Invalid condition JSON"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/activity-reward-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, trigger, rewardType, rewardValueJson, conditionJson }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      // Reset and refresh
      setOpen(false);
      setTrigger("REGISTRATION_APPROVED");
      setRewardType("POINTS");
      setPoints("50");
      setRewardValueRaw('{"points":50}');
      setStreakRequired("7");
      setConditionRaw("");
      onCreated?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(ruleId: string) {
    if (!confirm(zh ? "确认删除这条奖励规则？" : "Delete this reward rule?")) return;
    const res = await fetch(`/api/activity-reward-rules?id=${encodeURIComponent(ruleId)}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const hintForRewardType = REWARD_TYPES.find((r) => r.value === rewardType)?.hint ?? "{}";

  if (!open) {
    return (
      <button
        type="button"
        className="button button button"
        onClick={() => setOpen(true)}
      >
        {zh ? "+ 添加规则" : "+ Add Rule"}
      </button>
    );
  }

  return (
    <div className="form-grid" style={{ border: "1px solid var(--color-border)", borderRadius: "8px", padding: "1.25rem", marginBottom: "1.5rem" }}>
      <h3 style={{ marginBottom: "1rem", fontWeight: 600 }}>{zh ? "新建奖励规则" : "New Reward Rule"}</h3>

      {error && <div className="form-error form-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          {/* Trigger */}
          <div className="field">
            <label className="label">{zh ? "触发条件" : "Trigger"}</label>
            <select
              className="field"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>{zh ? t.zh : t.en}</option>
              ))}
            </select>
          </div>

          {/* Reward type */}
          <div className="field">
            <label className="label">{zh ? "奖励类型" : "Reward Type"}</label>
            <select
              className="field"
              value={rewardType}
              onChange={(e) => {
                setRewardType(e.target.value);
                const hint = REWARD_TYPES.find((r) => r.value === e.target.value)?.hint ?? "{}";
                if (e.target.value !== "POINTS") setRewardValueRaw(hint);
              }}
            >
              {REWARD_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{zh ? r.zh : r.en}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reward value */}
        <div className="field" style={{ marginBottom: "1rem" }}>
          <label className="label">
            {zh ? "奖励值" : "Reward Value"}
            {isPoints && <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>({zh ? "积分数量" : "points amount"})</span>}
          </label>
          {isPoints ? (
            <input
              type="number"
              className="field"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="50"
              style={{ maxWidth: "160px" }}
            />
          ) : (
            <textarea
              className="field"
              rows={2}
              value={rewardValueRaw}
              onChange={(e) => setRewardValueRaw(e.target.value)}
              placeholder={hintForRewardType}
              style={{ fontFamily: "monospace", fontSize: "0.85em" }}
            />
          )}
        </div>

        {/* Condition — auto-show streakRequired for CONSECUTIVE_CHECKIN */}
        {isConsecutiveCheckin ? (
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label className="label">{zh ? "连续天数 (streakRequired)" : "Streak Required (days)"}</label>
            <input
              type="number"
              className="field"
              min={2}
              value={streakRequired}
              onChange={(e) => setStreakRequired(e.target.value)}
              style={{ maxWidth: "120px" }}
            />
            <p style={{ fontSize: "0.8em", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              {zh ? "用户连续签到满此天数时触发" : "Reward fires when user reaches this consecutive-day streak"}
            </p>
          </div>
        ) : (
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label className="label">
              {zh ? "触发条件 (conditionJson，可选)" : "Condition JSON (optional)"}
            </label>
            <textarea
              className="field"
              rows={2}
              value={conditionRaw}
              onChange={(e) => setConditionRaw(e.target.value)}
              placeholder='{}'
              style={{ fontFamily: "monospace", fontSize: "0.85em" }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="submit" className="button button button" disabled={submitting}>
            {submitting ? (zh ? "保存中…" : "Saving…") : (zh ? "保存规则" : "Save Rule")}
          </button>
          <button type="button" className="button button" onClick={() => { setOpen(false); setError(null); }}>
            {zh ? "取消" : "Cancel"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function RewardRuleDeleteButton({ ruleId, locale }: { ruleId: string; locale: string }) {
  const zh = locale === "zh";
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(zh ? "确认删除这条奖励规则？" : "Delete this reward rule?")) return;
    const res = await fetch(`/api/activity-reward-rules?id=${encodeURIComponent(ruleId)}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <button
      type="button"
      className="button button"
      style={{ color: "var(--color-error, #dc2626)" }}
      onClick={handleDelete}
    >
      {zh ? "删除" : "Delete"}
    </button>
  );
}
