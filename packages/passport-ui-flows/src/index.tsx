/**
 * CP-TODO-258: reusable, themeable UI flows for CP-owned pages (CP-FR-072).
 *
 * Presentational only: no data fetching, no programme-specific business logic.
 * Shells theme via className / data-tone; strings are passed in by the host page
 * so the package never embeds copy or programme flows.
 */

import { useState } from "react";
import type { ReactNode } from "react";

export type DataActionCardProps = {
  title: string;
  description?: string;
  tone?: "default" | "danger";
  children?: ReactNode;
  className?: string;
};

/** 面板容器：数据治理类操作分组（导出/删除/偏好等）。 */
export function DataActionCard({ title, description, tone = "default", children, className }: DataActionCardProps) {
  return (
    <section className={["ui-flow-card", `ui-flow-card--${tone}`, className].filter(Boolean).join(" ")} data-tone={tone}>
      <h2 className="ui-flow-card__title">{title}</h2>
      {description ? <p className="ui-flow-card__description">{description}</p> : null}
      <div className="ui-flow-card__body">{children}</div>
    </section>
  );
}

export type ConfirmDangerActionProps = {
  label: string;
  confirmLabel: string;
  /** 必须键入的确认值（如 DELETE）。 */
  confirmValue: string;
  confirmationHint: string;
  successMessage?: string;
  busy?: boolean;
  onConfirm: () => Promise<{ retentionNotice?: string[] } | void> | { retentionNotice?: string[] } | void;
  className?: string;
};

/** 危险操作确认：键入确认值后才可执行；成功后可展示受限保留说明。 */
export function ConfirmDangerAction({
  label,
  confirmLabel,
  confirmValue,
  confirmationHint,
  successMessage,
  busy = false,
  onConfirm,
  className,
}: ConfirmDangerActionProps) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ready = value.trim().toUpperCase() === confirmValue.trim().toUpperCase();

  return (
    <div className={["ui-flow-confirm-danger", className].filter(Boolean).join(" ")}>
      {done ? (
        <div className="ui-flow-confirm-danger__success" role="status">
          {successMessage ? <p>{successMessage}</p> : null}
          {notice.length > 0 ? (
            <ul className="ui-flow-confirm-danger__notice">
              {notice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <>
          <p className="ui-flow-confirm-danger__hint">{confirmationHint}</p>
          <label className="ui-flow-confirm-danger__label">
            <span>{confirmLabel}</span>
            <input
              type="text"
              value={value}
              disabled={busy}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder={confirmValue}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="ui-flow-confirm-danger__button"
            disabled={!ready || busy}
            aria-disabled={!ready || busy}
            onClick={async () => {
              if (!ready || busy) return;
              try {
                const result = await onConfirm();
                setNotice(result && typeof result === "object" ? result.retentionNotice ?? [] : []);
                setDone(true);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            }}
          >
            {label}
          </button>
          {error ? (
            <p className="ui-flow-confirm-danger__error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export type StatusPillProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
};

/** 状态徽标：通用状态展示（同意/记录/通知状态）。 */
export function StatusPill({ children, tone = "neutral", className }: StatusPillProps) {
  return (
    <span className={["ui-flow-pill", `ui-flow-pill--${tone}`, className].filter(Boolean).join(" ")} data-tone={tone}>
      {children}
    </span>
  );
}
