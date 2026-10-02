"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/site-content";

type TicketStatus = "PENDING" | "REPLIED" | "CLOSED";

type Ticket = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  userId: string | null;
  category: string;
  subject: string;
  message: string;
  status: TicketStatus;
  adminReply: string | null;
  adminNotes: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  tickets?: Ticket[];
  counts?: Record<TicketStatus, number>;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  error?: string;
};

const STATUSES: TicketStatus[] = ["PENDING", "REPLIED", "CLOSED"];
const CATEGORIES = ["GENERAL", "ORGANIZATION", "PARTNERSHIP", "SPEAKER", "MEDIA", "SPONSOR", "VOLUNTEER", "OTHER"];
const PAGE_SIZE = 20;

function statusLabel(zh: boolean, status: TicketStatus) {
  if (status === "PENDING") return zh ? "待处理" : "Pending";
  if (status === "REPLIED") return zh ? "已回复" : "Replied";
  return zh ? "已关闭" : "Closed";
}

export function AdminMessageInbox({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<TicketStatus, number>>({ PENDING: 0, REPLIED: 0, CLOSED: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (search) params.set("search", search);

    const response = await fetch(`/api/admin/messages?${params.toString()}`);
    const result = (await response.json().catch(() => null)) as ListResponse | null;

    if (!response.ok || !result?.tickets) {
      setTickets([]);
      setError(result?.error ?? (zh ? "工单加载失败。" : "Failed to load tickets."));
      setLoading(false);
      return;
    }

    setTickets(result.tickets);
    if (result.counts) setCounts(result.counts);
    if (result.pagination) setTotalPages(result.pagination.totalPages);
    setLoading(false);
  }, [categoryFilter, page, search, statusFilter, zh]);

  useEffect(() => {
    void load();
  }, [load]);

  function openTicket(ticket: Ticket) {
    setSelected(ticket);
    setReply(ticket.adminReply ?? "");
    setNotes(ticket.adminNotes ?? "");
    setError("");
    setNotice("");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function patch(payload: { status?: string; adminReply?: string; adminNotes?: string }) {
    if (!selected) return;

    setBusy(true);
    setError("");
    setNotice("");

    const response = await fetch(`/api/admin/messages/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { ticket?: Ticket; error?: string } | null;

    if (!response.ok || !result?.ticket) {
      setBusy(false);
      setError(result?.error ?? (zh ? "工单更新失败。" : "Failed to update the ticket."));
      return;
    }

    const updated = result.ticket;
    setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
    setSelected(updated);
    setReply(updated.adminReply ?? "");
    setNotes(updated.adminNotes ?? "");
    setNotice(zh ? "工单已更新。" : "Ticket updated.");
    setBusy(false);
    void load();
  }

  return (
    <section className="section two-col admin-layout">
      <div className="panel admin-list-panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{zh ? "工单队列" : "Ticket queue"}</span>
            <h2>{zh ? "支持请求" : "Support requests"}</h2>
          </div>
        </div>

        <div className="button-row">
          {STATUSES.map((value) => (
            <button
              className={`button-secondary ${statusFilter === value ? "is-active" : ""}`}
              key={value}
              onClick={() => {
                setPage(1);
                setStatusFilter((current) => (current === value ? "" : value));
              }}
              type="button"
            >
              {statusLabel(zh, value)} · {counts[value]}
            </button>
          ))}
        </div>

        <form className="split" onSubmit={submitSearch}>
          <label className="field">
            <span>{zh ? "类别" : "Category"}</span>
            <select
              onChange={(event) => {
                setPage(1);
                setCategoryFilter(event.target.value);
              }}
              value={categoryFilter}
            >
              <option value="">{zh ? "全部类别" : "All categories"}</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{zh ? "关键词" : "Keyword"}</span>
            <input
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={zh ? "主题 / 姓名 / 邮箱" : "Subject / name / email"}
              type="search"
              value={searchInput}
            />
          </label>
          <button className="button" type="submit">
            {zh ? "搜索" : "Search"}
          </button>
        </form>

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p>{zh ? "加载中…" : "Loading…"}</p> : null}

        <div className="list admin-list">
          {tickets.map((ticket) => (
            <button
              className={`list-item admin-list-item ${ticket.id === selected?.id ? "is-active" : ""}`}
              key={ticket.id}
              onClick={() => openTicket(ticket)}
              type="button"
            >
              <span className="label">{statusLabel(zh, ticket.status)}</span>
              <strong>{ticket.subject}</strong>
              <p>
                {ticket.name} · {ticket.email}
              </p>
              <div className="footer-note compact-note">
                {ticket.category} · {new Date(ticket.createdAt).toLocaleDateString()}
              </div>
            </button>
          ))}
          {!loading && tickets.length === 0 ? (
            <p>{zh ? "没有符合条件的工单。" : "No tickets match these filters."}</p>
          ) : null}
        </div>

        {totalPages > 1 ? (
          <div className="button-row">
            <button
              className="button-secondary"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              {zh ? "上一页" : "Previous"}
            </button>
            <span className="footer-note">
              {page} / {totalPages}
            </span>
            <button
              className="button-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              {zh ? "下一页" : "Next"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{zh ? "工单详情" : "Ticket detail"}</span>
            <h2>{selected ? selected.subject : zh ? "未选择工单" : "No ticket selected"}</h2>
          </div>
        </div>

        {!selected ? (
          <p>{zh ? "从左侧队列中选择一个工单。" : "Select a ticket from the queue."}</p>
        ) : (
          <div className="form-grid">
            <p>
              {selected.name} · {selected.email}
              {selected.phone ? ` · ${selected.phone}` : ""}
              {selected.organization ? ` · ${selected.organization}` : ""}
            </p>
            <p>{selected.message}</p>
            <p className="footer-note">
              {statusLabel(zh, selected.status)} · {selected.category} ·{" "}
              {zh ? "提交于" : "Submitted"} {new Date(selected.createdAt).toLocaleString()}
              {selected.repliedAt
                ? ` · ${zh ? "回复于" : "Replied"} ${new Date(selected.repliedAt).toLocaleString()}`
                : ""}
            </p>

            <label className="field">
              <span>{zh ? "回复内容（提交者可见）" : "Reply (visible to the sender)"}</span>
              <textarea
                disabled={selected.status === "CLOSED"}
                onChange={(event) => setReply(event.target.value)}
                rows={6}
                value={reply}
              />
            </label>

            <label className="field">
              <span>{zh ? "内部备注（不展示给用户）" : "Internal notes (never shown to the sender)"}</span>
              <textarea
                disabled={selected.status === "CLOSED"}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                value={notes}
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}
            {notice ? <p className="form-success">{notice}</p> : null}

            {selected.status === "CLOSED" ? (
              <p className="footer-note">{zh ? "工单已关闭，内容只读。" : "This ticket is closed and read-only."}</p>
            ) : (
              <div className="button-row">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void patch({ adminReply: reply, status: "REPLIED" })}
                  type="button"
                >
                  {zh ? "保存并标记已回复" : "Save and mark replied"}
                </button>
                <button
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => void patch({ adminNotes: notes })}
                  type="button"
                >
                  {zh ? "仅保存备注" : "Save notes only"}
                </button>
                <button
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => void patch({ status: "CLOSED" })}
                  type="button"
                >
                  {zh ? "关闭工单" : "Close ticket"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
