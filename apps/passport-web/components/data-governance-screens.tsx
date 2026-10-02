"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/site-content";
import { DataActionCard, ConfirmDangerAction, StatusPill } from "@climate-passport/passport-ui-flows";

type ConsentRow = {
  id: string;
  purpose: string;
  channel: string | null;
  status: string;
  version: number;
  objectType: string | null;
  objectId: string | null;
};

type RecordRow = {
  id: string;
  recordType: string;
  title: string;
  status: string;
  currentRevision: number;
  updatedAt: string;
};

function text(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

async function readJson(response: Response) {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status})`);
  return body;
}

/** CP-TODO-258：数据与账户页（导出/删除，CP-FR-068 三动作分开的前端面）。 */
export function AccountDataScreen({ locale }: { locale: Locale }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const runExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) throw new Error(text(locale, "导出失败", "Export failed"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `climate-passport-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExporting(false);
    }
  }, [locale]);

  return (
    <main className="data-gov-screen">
      <h1>{text(locale, "数据与账户", "Data & Account")}</h1>
      <DataActionCard
        title={text(locale, "导出我的数据", "Export my data")}
        description={text(
          locale,
          "导出仅包含本人有权材料及索引，不包含其他作者的私密内容。",
          "The export contains only materials you are authorized to access, plus index entries — never other authors' private content."
        )}
      >
        <button type="button" className="data-gov-button" disabled={exporting} onClick={() => void runExport()}>
          {exporting ? text(locale, "导出中…", "Exporting…") : text(locale, "下载数据副本", "Download data copy")}
        </button>
        {exportError ? (
          <p role="alert" className="data-gov-error">
            {exportError}
          </p>
        ) : null}
      </DataActionCard>
      <DataActionCard
        tone="danger"
        title={text(locale, "删除账户", "Delete account")}
        description={text(
          locale,
          "删除与导出、撤回是三个分开的动作。删除会匿名化账户并撤回本人记录，审计与凭证历史按受限保留说明处理。",
          "Deletion is separate from export and withdrawal. Deletion anonymizes your account and withdraws your records; audit logs and credential history stay under the restricted retention notice."
        )}
      >
        <ConfirmDangerAction
          label={text(locale, "永久删除账户", "Permanently delete account")}
          confirmLabel={text(locale, "键入 DELETE 以确认", "Type DELETE to confirm")}
          confirmValue="DELETE"
          confirmationHint={text(
            locale,
            "此操作不可撤销。账户将被匿名化，会话立即失效。",
            "This cannot be undone. Your account will be anonymized and sessions revoked immediately."
          )}
          successMessage={text(locale, "账户已删除。", "Your account has been deleted.")}
          onConfirm={async () => {
            const response = await fetch("/api/account/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: "user self-service deletion", confirm: true }),
            });
            const body = await readJson(response);
            return { retentionNotice: Array.isArray(body.retentionNotice) ? (body.retentionNotice as string[]) : [] };
          }}
        />
      </DataActionCard>
    </main>
  );
}

/** CP-TODO-258：授权管理页（CP-FR-060 同意目的的前端面）。 */
export function ConsentsScreen({ locale }: { locale: Locale }) {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await readJson(await fetch("/api/consents", { cache: "no-store" }));
      setRows(Array.isArray(body.consents) ? (body.consents as ConsentRow[]) : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withdraw = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await readJson(await fetch(`/api/consents/${id}/withdraw`, { method: "POST" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="data-gov-screen">
      <h1>{text(locale, "授权管理", "Consents")}</h1>
      <p className="data-gov-lead">
        {text(locale, "各授权目的相互独立；撤回立即生效并阻断依赖该授权的发布。", "Purposes are independent; withdrawal is immediate and blocks dependent publications.")}
      </p>
      {error ? (
        <p role="alert" className="data-gov-error">
          {error}
        </p>
      ) : null}
      <ul className="data-gov-list">
        {rows.map((row) => (
          <li key={row.id} className="data-gov-list-item">
            <div>
              <strong>{row.purpose}</strong>
              <span className="data-gov-meta">
                {row.channel ?? text(locale, "通用渠道", "any channel")} · v{row.version}
                {row.objectType ? ` · ${row.objectType}` : ""}
              </span>
            </div>
            <StatusPill tone={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status}</StatusPill>
            {row.status === "ACTIVE" ? (
              <button type="button" className="data-gov-button data-gov-button--quiet" disabled={busyId === row.id} onClick={() => void withdraw(row.id)}>
                {text(locale, "撤回", "Withdraw")}
              </button>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="data-gov-empty">{text(locale, "暂无授权记录", "No consents yet")}</li> : null}
      </ul>
    </main>
  );
}

/** CP-TODO-258：我的记录页（CP-FR-057 私密记录的前端面）。 */
export function RecordsScreen({ locale }: { locale: Locale }) {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await readJson(await fetch("/api/records", { cache: "no-store" }));
      setRows(Array.isArray(body.records) ? (body.records as RecordRow[]) : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withdraw = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await readJson(await fetch(`/api/records/${id}`, { method: "DELETE" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="data-gov-screen">
      <h1>{text(locale, "我的记录", "My Records")}</h1>
      <p className="data-gov-lead">
        {text(locale, "记录默认私密；撤回后他人不可见。", "Records are private by default; withdrawing hides them from everyone else.")}
      </p>
      {error ? (
        <p role="alert" className="data-gov-error">
          {error}
        </p>
      ) : null}
      <ul className="data-gov-list">
        {rows.map((row) => (
          <li key={row.id} className="data-gov-list-item">
            <div>
              <strong>{row.title}</strong>
              <span className="data-gov-meta">
                {row.recordType} · rev.{row.currentRevision}
              </span>
            </div>
            <StatusPill tone={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status}</StatusPill>
            {row.status === "ACTIVE" ? (
              <button type="button" className="data-gov-button data-gov-button--quiet" disabled={busyId === row.id} onClick={() => void withdraw(row.id)}>
                {text(locale, "撤回", "Withdraw")}
              </button>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="data-gov-empty">{text(locale, "暂无记录", "No records yet")}</li> : null}
      </ul>
    </main>
  );
}
