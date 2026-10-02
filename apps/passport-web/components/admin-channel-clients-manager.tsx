"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/site-content";
import { usePromptDialog, type PromptRequest } from "@/components/prompt-dialog";

type ClientType = "USER_FACING" | "MACHINE";

type ChannelClientRow = {
  id: string;
  key: string;
  displayName: string;
  type: ClientType;
  programmeId: string;
  allowedOrigins: string[];
  allowedIps: string[];
  allowedScopes: string[];
  isActive: boolean;
  machineKeyRef: string | null;
  machineKeyIssuedAt: string | null;
  machineKeyExpiresAt: string | null;
  machineKeyRotatedAt: string | null;
  machineKeyLastUsedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  rateLimitLimit: number | null;
  rateLimitWindowMs: number | null;
  createdAt: string;
  machineKeyConfigured: boolean;
  machineKeyAlgorithm: string | null;
};

type ProgrammeOption = { id: string; key: string; name: string; nameEn: string | null };

type RateLimitBounds = { minLimit: number; maxLimit: number; minWindowMs: number; maxWindowMs: number };

type IssuedKey = { clientKey: string; openApiKey: string; machineKey: string; expiresAt: string | null };

type ListResponse = {
  clients?: ChannelClientRow[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  error?: string;
};

const PAGE_SIZE = 25;

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toLines(values: string[]): string {
  return values.join("\n");
}

function stamp(locale: Locale, value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-GB");
}

function scopePurpose(zh: boolean, scope: string): string {
  if (scope === "channel:session:bridge") return zh ? "会话桥接签发" : "Session bridge issue";
  if (scope === "channel:session:exchange") return zh ? "会话令牌换取" : "Session token exchange";
  if (scope === "channel:certificates:verify") return zh ? "证书查验" : "Certificate verification";
  if (scope === "dispatch:certificates:lifecycle") return zh ? "证书生命周期回执" : "Certificate lifecycle receipts";
  if (scope === "channel:decisions:submit") return zh ? "提交外部决定回执" : "Submit external decision receipts";
  if (scope === "dispatch:publications") return zh ? "发布与撤回扇出" : "Publication fan-out";
  if (scope === "channel:activities:source") return zh ? "活动来源绑定与修订" : "Activity source binding";
  return zh ? "解析 sourceRef" : "Resolve source references";
}

export function AdminChannelClientsManager({
  locale,
  programmes,
  scopeCatalog,
  keyPolicy,
}: {
  locale: Locale;
  programmes: ProgrammeOption[];
  scopeCatalog: string[];
  keyPolicy: { maxValidDays: number; rateLimitBounds: RateLimitBounds };
}) {
  const zh = locale === "zh";
  const [askPrompt, promptDialog] = usePromptDialog();
  const [clients, setClients] = useState<ChannelClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ClientType>("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [issued, setIssued] = useState<IssuedKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (typeFilter) params.set("type", typeFilter);
    if (programmeFilter) params.set("programmeId", programmeFilter);
    if (search) params.set("search", search);

    const response = await fetch(`/api/admin/channel-clients?${params.toString()}`);
    const result = (await response.json().catch(() => null)) as ListResponse | null;
    if (!response.ok || !result?.clients) {
      setClients([]);
      setTotal(0);
      setTotalPages(1);
      setError(result?.error ?? (zh ? "客户端列表加载失败。" : "Failed to load the client registry."));
      setLoading(false);
      return;
    }
    setClients(result.clients);
    if (result.pagination) {
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    }
    setLoading(false);
  }, [page, programmeFilter, search, typeFilter, zh]);

  useEffect(() => {
    void load();
  }, [load]);

  const programmeById = useMemo(() => new Map(programmes.map((item) => [item.id, item])), [programmes]);

  const selected = clients.find((client) => client.id === selectedId) ?? null;

  /** 换筛选条件或翻页后，选中行可能已不在当前页；连同一次性明文一起清掉。 */
  function clearSelection() {
    setSelectedId("");
    setIssued(null);
  }

  function changeFilter(next: () => void) {
    next();
    setPage(1);
    clearSelection();
  }

  function onIssued(next: IssuedKey | null) {
    setIssued(next);
    void load();
  }

  return (
    <section className="section two-col admin-channel-clients admin-layout">
      <div className="panel admin-list-panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{zh ? "已登记客户端" : "Registered clients"}</span>
            <h2>{zh ? `凭据清单 · ${total}` : `Credential list · ${total}`}</h2>
          </div>
        </div>

        <div className="button-row">
          {(["", "MACHINE", "USER_FACING"] as const).map((value) => (
            <button
              className={`button-secondary ${typeFilter === value ? "is-active" : ""}`}
              key={value || "all"}
              onClick={() => changeFilter(() => setTypeFilter(value))}
              type="button"
            >
              {value === "" ? (zh ? "全部类型" : "All types") : value === "MACHINE" ? (zh ? "机器" : "Machine") : (zh ? "面向用户" : "User facing")}
            </button>
          ))}
        </div>

        <form
          className="split"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            changeFilter(() => setSearch(searchInput.trim()));
          }}
        >
          <label className="field">
            <span>{zh ? "按 Programme 筛选" : "Filter by programme"}</span>
            <select onChange={(event) => changeFilter(() => setProgrammeFilter(event.target.value))} value={programmeFilter}>
              <option value="">{zh ? "全部 Programme" : "All programmes"}</option>
              {programmes.map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programme.key} · {(locale === "zh" ? programme.name : programme.nameEn ?? programme.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{zh ? "关键词" : "Keyword"}</span>
            <input
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={zh ? "展示名 / client key" : "Display name / client key"}
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
          {clients.map((client) => {
            const expired =
              client.machineKeyExpiresAt !== null && new Date(client.machineKeyExpiresAt).getTime() < Date.now();
            return (
              <button
                className={`list-item admin-list-item ${client.id === selectedId ? "is-active" : ""}`}
                key={client.id}
                onClick={() => {
                  setSelectedId(client.id);
                  setIssued(null);
                }}
                type="button"
              >
                <span className="label">
                  {client.type === "MACHINE" ? (zh ? "机器客户端" : "Machine client") : zh ? "面向用户" : "User facing"}
                  {client.isActive ? "" : ` · ${zh ? "已撤销" : "Revoked"}`}
                  {expired ? ` · ${zh ? "密钥已过期" : "Key expired"}` : ""}
                </span>
                <strong>{client.displayName}</strong>
                <p>{client.key}</p>
                <p>{(programmes.find((programme) => programme.id === client.programmeId)?.key) ?? client.programmeId}</p>
                <div className="footer-note compact-note">
                  {client.allowedScopes.length} {zh ? "个 scope" : "scopes"} ·{" "}
                  {client.machineKeyAlgorithm === "sha256-legacy"
                    ? zh
                      ? "遗留 sha256，待轮换"
                      : "legacy sha256, awaiting rotation"
                    : client.machineKeyAlgorithm === "bcrypt"
                      ? zh
                        ? "bcrypt"
                        : "bcrypt"
                      : zh
                        ? "无机密"
                        : "no secret"}
                  {" · "}
                  {zh ? "最近使用" : "last used"} {stamp(locale, client.machineKeyLastUsedAt)}
                </div>
              </button>
            );
          })}
          {!loading && clients.length === 0 ? (
            <p>{zh ? "没有符合筛选条件的客户端。" : "No clients match these filters."}</p>
          ) : null}
        </div>

        {totalPages > 1 ? (
          <div className="button-row">
            <button
              className="button-secondary"
              disabled={page <= 1 || loading}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
                clearSelection();
              }}
              type="button"
            >
              {zh ? "上一页" : "Previous"}
            </button>
            <span className="footer-note">
              {page} / {totalPages}
            </span>
            <button
              className="button-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => {
                setPage((current) => current + 1);
                clearSelection();
              }}
              type="button"
            >
              {zh ? "下一页" : "Next"}
            </button>
          </div>
        ) : null}

        <div className="button-row">
          <button
            className="button-secondary"
            onClick={() => {
              setSelectedId("");
              setIssued(null);
            }}
            type="button"
          >
            {zh ? "登记新客户端" : "Register a new client"}
          </button>
        </div>
      </div>

      <div className="panel">
        {issued ? (
          <div className="form-success">
            <p>
              {zh
                ? "这是机密唯一一次以明文出现。请立即保存；系统只留 bcrypt 摘要，之后任何接口都取不回来。"
                : "This is the only time the secret is shown in plaintext. Save it now: only the bcrypt digest is kept, and no endpoint will ever return it again."}
            </p>
            {issued.openApiKey ? (
              <label className="field">
                <span>{zh ? "Open API 凭据（Authorization: Bearer …）" : "Open API credential (Authorization: Bearer …)"}</span>
                <input onFocus={(event) => event.currentTarget.select()} readOnly value={issued.openApiKey} />
              </label>
            ) : null}
            {issued.machineKey ? (
              <label className="field">
                <span>{zh ? "machine key（x-channel-machine-key）" : "Machine key (x-channel-machine-key)"}</span>
                <input onFocus={(event) => event.currentTarget.select()} readOnly value={issued.machineKey} />
              </label>
            ) : null}
            <p className="footer-note">
              {issued.clientKey} · {zh ? "有效期至" : "valid until"} {stamp(locale, issued.expiresAt)}
            </p>
          </div>
        ) : null}

        {selected ? (
          <ClientPolicyPanel
            key={selected.id}
            client={selected}
            isMachine={selected.type === "MACHINE"}
            keyPolicy={keyPolicy}
            locale={locale}
            onIssued={onIssued}
            onReload={() => void load()}
            programmeLabel={programmeById.get(selected.programmeId)?.key ?? selected.programmeId}
            scopeCatalog={scopeCatalog}
            zh={zh}
            askPrompt={askPrompt}
          />
        ) : (
          <RegisterPanel
            keyPolicy={keyPolicy}
            locale={locale}
            onIssued={onIssued}
            programmes={programmes}
            scopeCatalog={scopeCatalog}
            zh={zh}
          />
        )}
      </div>
      {promptDialog}
    </section>
  );
}

function RegisterPanel({
  locale,
  programmes,
  scopeCatalog,
  keyPolicy,
  zh,
  onIssued,
}: {
  locale: Locale;
  programmes: ProgrammeOption[];
  scopeCatalog: string[];
  keyPolicy: { maxValidDays: number; rateLimitBounds: RateLimitBounds };
  zh: boolean;
  onIssued: (issued: IssuedKey | null) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<ClientType>("MACHINE");
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? "");
  const [key, setKey] = useState("");
  const [origins, setOrigins] = useState("");
  const [ips, setIps] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [limit, setLimit] = useState("");
  const [windowMs, setWindowMs] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [machineKey, setMachineKey] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bounds = keyPolicy.rateLimitBounds;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      displayName: displayName.trim(),
      type,
      programmeId,
      allowedOrigins: parseList(origins),
      allowedIps: parseList(ips),
      allowedScopes: scopes,
      ...(key.trim() ? { key: key.trim() } : {}),
      ...(limit ? { rateLimitLimit: Number(limit) } : {}),
      ...(windowMs ? { rateLimitWindowMs: Number(windowMs) } : {}),
      ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
      ...(type === "MACHINE" && machineKey.trim() ? { machineKey: machineKey.trim() } : {}),
      ...(callbackUrl.trim() ? { callbackUrl: callbackUrl.trim() } : {}),
    };

    const response = await fetch("/api/admin/channel-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as {
      client?: { id: string; key: string };
      machineKey?: string | null;
      openApiKey?: string | null;
      machineKeyExpiresAt?: string | null;
      error?: string;
    } | null;

    if (!response.ok || !result?.client) {
      setError(result?.error ?? (zh ? "登记失败，未产生任何变更。" : "Registration failed. No state was changed."));
      setBusy(false);
      return;
    }

    setDisplayName("");
    setKey("");
    setOrigins("");
    setIps("");
    setScopes([]);
    setLimit("");
    setWindowMs("");
    setExpiresInDays("");
    setMachineKey("");
    setCallbackUrl("");
    setBusy(false);
    onIssued({
      clientKey: result.client.key,
      openApiKey: result.openApiKey ?? "",
      machineKey: result.machineKey ?? "",
      expiresAt: result.machineKeyExpiresAt ?? null,
    });
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="section-header compact-header">
        <div>
          <span className="label">{zh ? "登记新客户端" : "Register a client"}</span>
          <h2>{zh ? "发放一把新的 API Key" : "Issue a new API key"}</h2>
        </div>
      </div>
      <p className="footer-note">
        {zh
          ? "client key 可以留空由系统生成；机密一律服务端生成并只回显一次。授予的 scope 决定这把 key 能调用哪些端点。"
          : "The client key can be left blank for server generation; secrets are always generated server-side and echoed once. Granted scopes decide which endpoints this key may call."}
      </p>

      <label className="field">
        <span>{zh ? "展示名" : "Display name"}</span>
        <input onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
      </label>
      <label className="field">
        <span>{zh ? "类型" : "Type"}</span>
        <select onChange={(event) => setType(event.target.value as ClientType)} value={type}>
          <option value="MACHINE">{zh ? "机器客户端（对外 API）" : "Machine client (outward API)"}</option>
          <option value="USER_FACING">{zh ? "面向用户" : "User facing"}</option>
        </select>
      </label>
      <label className="field">
        <span>{zh ? "发放给哪个 Programme" : "Issue for programme"}</span>
        <select onChange={(event) => setProgrammeId(event.target.value)} required value={programmeId}>
          <option value="">{zh ? "请选择" : "Select one"}</option>
          {programmes.map((programme) => (
            <option key={programme.id} value={programme.id}>
              {programme.key} · {(locale === "zh" ? programme.name : programme.nameEn ?? programme.name)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{zh ? "client key（留空自动生成）" : "Client key (blank = generated)"}</span>
        <input onChange={(event) => setKey(event.target.value)} placeholder="CPK…" value={key} />
      </label>

      <label className="field">
        <span>{zh ? "允许的来源 Origin（每行一个）" : "Allowed origins (one per line)"}</span>
        <textarea onChange={(event) => setOrigins(event.target.value)} rows={2} value={origins} />
      </label>
      <label className="field">
        <span>{zh ? "允许的来源 IP / CIDR（每行一个）" : "Allowed IPs / CIDR (one per line)"}</span>
        <textarea onChange={(event) => setIps(event.target.value)} rows={2} value={ips} />
      </label>

      <fieldset className="field">
        <legend>{zh ? "授予的 scope（至少一个）" : "Granted scopes (at least one)"}</legend>
        {scopeCatalog.map((scope) => (
          <label className="toggle-field" key={scope}>
            <input
              checked={scopes.includes(scope)}
              onChange={(event) =>
                setScopes((current) =>
                  event.target.checked ? [...current, scope] : current.filter((value) => value !== scope),
                )
              }
              type="checkbox"
            />
            <span>{scope} · {scopePurpose(zh, scope)}</span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>{zh ? `限流次数（${bounds.minLimit}–${bounds.maxLimit}，留空用端点默认）` : `Rate limit count (${bounds.minLimit}–${bounds.maxLimit}, blank = endpoint default)`}</span>
        <input min={bounds.minLimit} max={bounds.maxLimit} onChange={(event) => setLimit(event.target.value)} type="number" value={limit} />
      </label>
      <label className="field">
        <span>{zh ? `限流窗口毫秒（留空用端点默认）` : "Rate limit window (ms, blank = endpoint default)"}</span>
        <input
          max={bounds.maxWindowMs}
          min={bounds.minWindowMs}
          onChange={(event) => setWindowMs(event.target.value)}
          type="number"
          value={windowMs}
        />
      </label>
      <label className="field">
        <span>{zh ? `有效期天数（1–${keyPolicy.maxValidDays}，留空用默认）` : `Validity in days (1–${keyPolicy.maxValidDays}, blank = default)`}</span>
        <input max={keyPolicy.maxValidDays} min={1} onChange={(event) => setExpiresInDays(event.target.value)} type="number" value={expiresInDays} />
      </label>
      <label className="field">
        <span>{zh ? "自带机密（可选，cpmk_ 前缀，16–72 字符）" : "Bring your own secret (optional, cpmk_ prefix, 16–72 chars)"}</span>
        <input disabled={type !== "MACHINE"} onChange={(event) => setMachineKey(event.target.value)} value={machineKey} />
      </label>
      <label className="field">
        <span>{zh ? "回调 URL（可选，https）" : "Callback URL (optional, https)"}</span>
        <input onChange={(event) => setCallbackUrl(event.target.value)} placeholder="https://…" value={callbackUrl} />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      <div className="button-row">
        <button className="button" disabled={busy || scopes.length === 0} type="submit">
          {zh ? "登记并发放密钥" : "Register and issue key"}
        </button>
      </div>
      {scopes.length === 0 ? (
        <p className="footer-note">{zh ? "未选 scope 时不会提交：空 scope 的 key 什么也做不了。" : "Submit stays disabled without a scope: a key with no scopes can do nothing."}</p>
      ) : null}
    </form>
  );
}

function ClientPolicyPanel({
  client,
  isMachine,
  locale,
  programmeLabel,
  scopeCatalog,
  keyPolicy,
  zh,
  askPrompt,
  onIssued,
  onReload,
}: {
  client: ChannelClientRow;
  isMachine: boolean;
  locale: Locale;
  programmeLabel: string;
  scopeCatalog: string[];
  keyPolicy: { maxValidDays: number; rateLimitBounds: RateLimitBounds };
  zh: boolean;
  askPrompt: (request: PromptRequest) => Promise<string | null>;
  onIssued: (issued: IssuedKey | null) => void;
  onReload: () => void;
}) {
  const [displayName, setDisplayName] = useState(client.displayName);
  const [origins, setOrigins] = useState(toLines(client.allowedOrigins));
  const [ips, setIps] = useState(toLines(client.allowedIps));
  const [scopes, setScopes] = useState<string[]>(client.allowedScopes);
  const [limit, setLimit] = useState(client.rateLimitLimit === null ? "" : String(client.rateLimitLimit));
  const [windowMs, setWindowMs] = useState(client.rateLimitWindowMs === null ? "" : String(client.rateLimitWindowMs));
  const [expiresInDays, setExpiresInDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const bounds = keyPolicy.rateLimitBounds;
  const expired = client.machineKeyExpiresAt !== null && new Date(client.machineKeyExpiresAt).getTime() < Date.now();

  async function savePolicy() {
    setBusy(true);
    setError("");
    setNotice("");

    const quotaChanged = limit !== (client.rateLimitLimit === null ? "" : String(client.rateLimitLimit)) || windowMs !== (client.rateLimitWindowMs === null ? "" : String(client.rateLimitWindowMs));
    const payload = {
      displayName: displayName.trim(),
      allowedOrigins: parseList(origins),
      allowedIps: parseList(ips),
      allowedScopes: scopes,
      // 两项一起提交：服务端按「这一对被改了」处理，只发一项会把另一项悄悄重置为默认。
      ...(quotaChanged ? { rateLimitLimit: limit ? Number(limit) : null, rateLimitWindowMs: windowMs ? Number(windowMs) : null } : {}),
    };

    const response = await fetch(`/api/admin/channel-clients/${encodeURIComponent(client.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { client?: { id: string; key: string }; error?: string } | null;

    if (!response.ok || !result?.client) {
      setError(result?.error ?? (zh ? "更新失败，未产生任何变更。" : "Update failed. No state was changed."));
      setBusy(false);
      return;
    }
    setBusy(false);
    setNotice(zh ? "策略已更新。" : "Policy updated.");
    onReload();
  }

  async function rotateKey() {
    const reason = await askPrompt({
      confirmLabel: zh ? "确认轮换" : "Confirm rotation",
      description: zh
        ? "旧机密当场失效，调用方必须换用新值；原因会写入审计日志。"
        : "The previous secret stops working immediately and callers must switch to the new value. The reason is written to the audit log.",
      label: zh ? "轮换原因" : "Rotation reason",
      locale,
      maxLength: 500,
      minLength: 3,
      multiline: true,
      title: zh ? `轮换 ${client.displayName} 的密钥` : `Rotate the key of ${client.displayName}`,
    });
    if (!reason) return;

    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/channel-clients/${encodeURIComponent(client.id)}/rotate-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expiresInDays ? { reason, expiresInDays: Number(expiresInDays) } : { reason }),
    });
    const result = (await response.json().catch(() => null)) as {
      client?: { id: string; key: string };
      machineKey?: string | null;
      openApiKey?: string | null;
      machineKeyExpiresAt?: string | null;
      error?: string;
    } | null;

    if (!response.ok || !result?.client) {
      setError(result?.error ?? (zh ? "轮换失败，旧密钥仍然有效。" : "Rotation failed. The previous key is still valid."));
      setBusy(false);
      return;
    }
    setBusy(false);
    setExpiresInDays("");
    onIssued({
      clientKey: client.key,
      openApiKey: result.openApiKey ?? "",
      machineKey: result.machineKey ?? "",
      expiresAt: result.machineKeyExpiresAt ?? null,
    });
  }

  async function revokeClient() {
    const reason = await askPrompt({
      confirmLabel: zh ? "确认撤销" : "Confirm revocation",
      description: zh
        ? "撤销不可逆：这把 key 立即变为 401，原因会写入审计日志。要恢复只能重新登记。"
        : "Revocation is irreversible: this key starts answering 401 at once and the reason is written to the audit log. Recovery means registering a new client.",
      label: zh ? "撤销原因" : "Revocation reason",
      locale,
      maxLength: 500,
      minLength: 3,
      multiline: true,
      title: zh ? `撤销 ${client.displayName}` : `Revoke ${client.displayName}`,
    });
    if (!reason) return;

    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/channel-clients/${encodeURIComponent(client.id)}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const result = (await response.json().catch(() => null)) as { client?: { id: string; key: string }; error?: string } | null;

    if (!response.ok || !result?.client) {
      setError(result?.error ?? (zh ? "撤销失败，未产生任何变更。" : "Revoke failed. No state was changed."));
      setBusy(false);
      return;
    }
    setBusy(false);
    setNotice(zh ? "客户端已撤销。" : "Client revoked.");
    onReload();
  }

  return (
    <div className="form-grid">
      <div className="section-header compact-header">
        <div>
          <span className="label">{zh ? "凭据与策略" : "Credential and policy"}</span>
          <h2>{client.displayName}</h2>
        </div>
      </div>

      <p className="footer-note">
        {client.key} · {isMachine ? (zh ? "机器" : "Machine") : (zh ? "面向用户" : "User facing")} · {programmeLabel}
        {" · "}
        {zh ? "登记于" : "registered"} {stamp(locale, client.createdAt)}
      </p>
      <p className="footer-note">
        {zh ? "client key、类型与所属 Programme 不可变更；改这些等于换一把 key。" : "The client key, type and programme are immutable; changing those means issuing a new key."}
      </p>

      {isMachine ? (
        <div className="footer-note compact-note">
          <p>
            {zh ? "密钥状态" : "Key state"}：{client.machineKeyConfigured ? (zh ? "已配置" : "configured") : zh ? "无机密" : "no secret"}
            {" · "}
            {client.machineKeyAlgorithm === "sha256-legacy" ? zh ? "遗留 sha256（轮换后改为 bcrypt）" : "legacy sha256 (bcrypt after rotation)" : "bcrypt"}
          </p>
          <p>
            {zh ? "签发" : "issued"} {stamp(locale, client.machineKeyIssuedAt)} · {zh ? "轮换" : "rotated"}{" "}
            {stamp(locale, client.machineKeyRotatedAt)} · {zh ? "最近使用" : "last used"}{" "}
            {stamp(locale, client.machineKeyLastUsedAt)}
          </p>
          <p className={expired ? "form-error" : ""}>
            {zh ? "到期" : "expires"} {stamp(locale, client.machineKeyExpiresAt)}
            {expired ? ` · ${zh ? "已过期：请求会被拒为 403 API_KEY_EXPIRED" : " · expired: requests fail 403 API_KEY_EXPIRED"}` : ""}
          </p>
        </div>
      ) : null}

      {!client.isActive ? (
        <p className="form-error">
          {zh ? "已撤销，内容只读。" : "Revoked and read-only."} {client.revokeReason ?? ""}（{stamp(locale, client.revokedAt)}）
        </p>
      ) : null}

      <label className="field">
        <span>{zh ? "展示名" : "Display name"}</span>
        <input disabled={!client.isActive} onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
      </label>
      <label className="field">
        <span>{zh ? "允许的来源 Origin（每行一个）" : "Allowed origins (one per line)"}</span>
        <textarea disabled={!client.isActive} onChange={(event) => setOrigins(event.target.value)} rows={2} value={origins} />
      </label>
      <label className="field">
        <span>{zh ? "允许的来源 IP / CIDR（每行一个）" : "Allowed IPs / CIDR (one per line)"}</span>
        <textarea disabled={!client.isActive} onChange={(event) => setIps(event.target.value)} rows={2} value={ips} />
      </label>

      <fieldset className="field">
        <legend>{zh ? "授予的 scope（至少一个）" : "Granted scopes (at least one)"}</legend>
        {scopeCatalog.map((scope) => (
          <label className="toggle-field" key={scope}>
            <input
              checked={scopes.includes(scope)}
              disabled={!client.isActive}
              onChange={(event) =>
                setScopes((current) =>
                  event.target.checked ? [...current, scope] : current.filter((value) => value !== scope),
                )
              }
              type="checkbox"
            />
            <span>{scope} · {scopePurpose(zh, scope)}</span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>{zh ? `限流次数（留空＝用端点默认）` : `Rate limit count (blank = endpoint default)`}</span>
        <input
          disabled={!client.isActive}
          max={bounds.maxLimit}
          min={bounds.minLimit}
          onChange={(event) => setLimit(event.target.value)}
          type="number"
          value={limit}
        />
      </label>
      <label className="field">
        <span>{zh ? "限流窗口毫秒（留空＝用端点默认）" : "Rate limit window (ms, blank = endpoint default)"}</span>
        <input
          disabled={!client.isActive}
          max={bounds.maxWindowMs}
          min={bounds.minWindowMs}
          onChange={(event) => setWindowMs(event.target.value)}
          type="number"
          value={windowMs}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      <div className="button-row">
        <button
          className="button"
          disabled={!client.isActive || busy || scopes.length === 0}
          onClick={() => void savePolicy()}
          type="button"
        >
          {zh ? "保存策略" : "Save policy"}
        </button>
        {isMachine ? (
          <>
            <label className="field">
              <span>{zh ? "新有效期天数（可选）" : "New validity in days (optional)"}</span>
              <input
                disabled={busy}
                max={keyPolicy.maxValidDays}
                min={1}
                onChange={(event) => setExpiresInDays(event.target.value)}
                placeholder={zh ? "留空用默认" : "blank = default"}
                type="number"
                value={expiresInDays}
              />
            </label>
            <button className="button-secondary" disabled={!client.isActive || busy} onClick={() => void rotateKey()} type="button">
              {zh ? "轮换密钥" : "Rotate key"}
            </button>
          </>
        ) : null}
        <button className="button-secondary" disabled={!client.isActive || busy} onClick={() => void revokeClient()} type="button">
          {zh ? "撤销客户端" : "Revoke client"}
        </button>
      </div>
    </div>
  );
}
