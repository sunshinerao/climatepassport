import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

export const AI_DRAFT_KINDS = ["SUMMARY", "HIGHLIGHTS", "OVERVIEW_COPY"] as const;
export const AI_DRAFT_LOCALES = ["zh", "en"] as const;
export type AiDraftKind = (typeof AI_DRAFT_KINDS)[number];
export type AiDraftLocale = (typeof AI_DRAFT_LOCALES)[number];

const MAX_SOURCE_CHARS = 8_000;
const MAX_OUTPUT_CHARS = 4_000;
const MAX_HIGHLIGHTS = 8;
const CONFIG_ALIAS = /^[a-zA-Z0-9._:-]{1,100}$/;

export class AiContentError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

function bounded(value: string | null | undefined, max: number) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The allowlist intentionally excludes agenda, speakers, people and all participation data. */
export function buildSafeActivityAiSource(activity: {
  title: string; titleEn: string | null; subtitle: string | null; subtitleEn: string | null;
  summary: string | null; summaryEn: string | null; description: string | null; descriptionEn: string | null;
}, locale: AiDraftLocale) {
  const values = locale === "zh"
    ? [activity.title, activity.subtitle, activity.summary, activity.description]
    : [activity.titleEn ?? activity.title, activity.subtitleEn ?? activity.subtitle, activity.summaryEn ?? activity.summary, activity.descriptionEn ?? activity.description];
  const labels = locale === "zh" ? ["标题", "副标题", "摘要", "介绍"] : ["Title", "Subtitle", "Summary", "Description"];
  let used = 0;
  const fields = values.map((value, index) => {
    const remaining = Math.max(0, MAX_SOURCE_CHARS - used);
    const text = bounded(value, Math.min(2_000, remaining));
    used += text.length;
    return text ? `${labels[index]}: ${text}` : "";
  }).filter(Boolean);
  const source = fields.join("\n");
  return { source, sourceHash: createHash("sha256").update(source).digest("hex"), sourceFieldCount: fields.length, sourceCharacterCount: source.length };
}

function configuredProvider() {
  if (process.env.AI_CONTENT_ASSIST_ENABLED !== "true") throw new AiContentError("AI_ASSIST_UNAVAILABLE", 503);
  if (process.env.AI_CONTENT_ASSIST_PROVIDER !== "openai") throw new AiContentError("AI_ASSIST_UNAVAILABLE", 503);
  const model = process.env.AI_CONTENT_ASSIST_MODEL;
  const apiKey = process.env.AI_CONTENT_ASSIST_OPENAI_API_KEY;
  if (!model || !apiKey || !CONFIG_ALIAS.test(model)) throw new AiContentError("AI_ASSIST_UNAVAILABLE", 503);
  return { model, apiKey };
}

export function validateDraftOutput(kind: AiDraftKind, value: unknown): Prisma.InputJsonValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AiContentError("INVALID_PROVIDER_OUTPUT", 502);
  const output = value as Record<string, unknown>;
  if (kind === "HIGHLIGHTS") {
    if (!Array.isArray(output.items) || output.items.length < 1 || output.items.length > MAX_HIGHLIGHTS || !output.items.every((item) => typeof item === "string" && bounded(item, 300) === item.trim() && item.length > 0)) throw new AiContentError("INVALID_PROVIDER_OUTPUT", 502);
    return { items: output.items };
  }
  if (typeof output.text !== "string" || !output.text.trim() || output.text.length > MAX_OUTPUT_CHARS) throw new AiContentError("INVALID_PROVIDER_OUTPUT", 502);
  return { text: output.text.trim() };
}

export async function generateActivityAiContent(kind: AiDraftKind, locale: AiDraftLocale, source: string) {
  const { model, apiKey } = configuredProvider();
  const shape = kind === "HIGHLIGHTS" ? '{"items":["..."]}' : '{"text":"..."}';
  const instruction = locale === "zh"
    ? `仅根据以下公开活动文案撰写${kind === "HIGHLIGHTS" ? "1至8条亮点" : "简洁活动文案"}。不得补充未提供的事实、人物或承诺。只返回 JSON：${shape}`
    : `Write ${kind === "HIGHLIGHTS" ? "1 to 8 highlights" : "concise activity copy"} only from the public activity copy below. Do not invent facts, people, or commitments. Return JSON only: ${shape}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 700, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return valid JSON only." }, { role: "user", content: `${instruction}\n\n${source}` }] }),
    });
    if (!response.ok) throw new AiContentError("PROVIDER_UNAVAILABLE", 502);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const raw = payload.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || raw.length > MAX_OUTPUT_CHARS + 1_000) throw new AiContentError("INVALID_PROVIDER_OUTPUT", 502);
    return { outputJson: validateDraftOutput(kind, JSON.parse(raw)), providerAlias: "openai", modelAlias: model };
  } catch (error) {
    if (error instanceof AiContentError) throw error;
    throw new AiContentError("PROVIDER_UNAVAILABLE", 502);
  } finally { clearTimeout(timeout); }
}

export function publicDraft(draft: Record<string, unknown>) {
  const { outputJson, ...metadata } = draft;
  return { ...metadata, outputJson };
}
