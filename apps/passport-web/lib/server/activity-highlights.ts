/**
 * AI highlights generation service for Activity events.
 * Adapted from my-app app/api/events/[id]/generate-highlights/route.ts
 */

import { getPrismaClient } from "./prisma";

export type GenerationLocale = "zh" | "en";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function extractHighlights(raw: string, fallbackCount: number): string[] {
  try {
    const parsed = JSON.parse(raw) as { highlights?: unknown };
    const direct = toStringArray(parsed.highlights);
    if (direct.length > 0) return direct.slice(0, fallbackCount);
  } catch {
    // ignore and attempt to recover from fenced JSON
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { highlights?: unknown };
      const recovered = toStringArray(parsed.highlights);
      if (recovered.length > 0) return recovered.slice(0, fallbackCount);
    } catch {
      return [];
    }
  }

  return [];
}

function buildPrompt(params: {
  locale: GenerationLocale;
  title: string;
  description: string;
  agendaLines: string[];
  speakerLines: string[];
  count: number;
}) {
  const { locale, title, description, agendaLines, speakerLines, count } = params;

  if (locale === "zh") {
    return `请根据以下活动信息生成 ${count} 条活动亮点。\n\n要求：\n1. 每条 14-32 个中文字符\n2. 不要空话，突出具体价值\n3. 不要出现夸张词（如“史上最强”）\n4. 只输出 JSON\n\n活动标题：${title}\n活动描述：${description}\n\n议程要点：\n${agendaLines.join("\n") || "- 暂无"}\n\n嘉宾要点：\n${speakerLines.join("\n") || "- 暂无"}\n\n输出格式：\n{"highlights":["亮点1","亮点2","亮点3","亮点4","亮点5"]}`;
  }

  return `Generate ${count} event highlights based on the following information.\n\nRequirements:\n1. Each highlight should be 8-20 words\n2. Be concrete and informative\n3. Avoid exaggerated marketing claims\n4. Output JSON only\n\nTitle: ${title}\nDescription: ${description}\n\nAgenda:\n${agendaLines.join("\n") || "- None"}\n\nSpeakers:\n${speakerLines.join("\n") || "- None"}\n\nOutput format:\n{"highlights":["Highlight 1","Highlight 2","Highlight 3","Highlight 4","Highlight 5"]}`;
}

export async function generateHighlightsWithOpenAI(params: {
  apiKey: string;
  model: string;
  locale: GenerationLocale;
  title: string;
  description: string;
  agendaLines: string[];
  speakerLines: string[];
  count: number;
}): Promise<string[]> {
  const prompt = buildPrompt(params);

  let response: Response | null = null;
  let lastNetworkError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: "You are a concise event copywriter. Return valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      break;
    } catch (error) {
      clearTimeout(timeout);
      lastNetworkError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  if (!response) {
    const cause =
      lastNetworkError instanceof Error
        ? lastNetworkError.message
        : "Unknown network error";
    throw new Error(`OpenAI network request failed after retries: ${cause}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI response does not contain message content");
  }

  const highlights = extractHighlights(content, params.count);
  if (highlights.length < 3) {
    throw new Error("OpenAI returned insufficient highlights");
  }

  return highlights.slice(0, params.count);
}

export async function tryGenerateHighlightsAfterSave(activityId: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    console.warn("[activity-highlights] OPENAI_API_KEY not configured, skipping auto-generation");
    return;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const count = Number.parseInt(process.env.HIGHLIGHT_COUNT || "5", 10);

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        agendaItems: {
          include: {
            speakers: {
              include: {
                speaker: {
                  select: {
                    name: true,
                    nameEn: true,
                    title: true,
                    titleEn: true,
                    organization: true,
                    organizationEn: true,
                  },
                },
              },
            },
          },
          orderBy: [{ agendaDate: "asc" }, { order: "asc" }, { startTime: "asc" }],
          take: 12,
        },
        speakerLinks: {
          include: {
            speaker: {
              select: {
                name: true,
                nameEn: true,
                title: true,
                titleEn: true,
                organization: true,
                organizationEn: true,
              },
            },
          },
          take: 12,
        },
      },
    });

    if (!activity) return;

    const agendaLinesZh = activity.agendaItems.map(
      (item) =>
        `- ${item.startTime}-${item.endTime} ${item.title}${item.description ? `：${item.description}` : ""}`
    );

    const agendaLinesEn = activity.agendaItems.map((item) => {
      const title = item.titleEn || item.title;
      const desc = item.descriptionEn || item.description;
      return `- ${item.startTime}-${item.endTime} ${title}${desc ? `: ${desc}` : ""}`;
    });

    // Collect unique speakers from both agenda items and speaker links
    const speakerSet = new Map<string, { name: string; nameEn?: string | null; title?: string | null; titleEn?: string | null; organization?: string | null; organizationEn?: string | null }>();

    for (const item of activity.agendaItems) {
      for (const link of item.speakers) {
        if (!speakerSet.has(link.speakerId)) {
          speakerSet.set(link.speakerId, link.speaker);
        }
      }
    }
    for (const link of activity.speakerLinks) {
      if (!speakerSet.has(link.speakerId)) {
        speakerSet.set(link.speakerId, link.speaker);
      }
    }

    const speakers = Array.from(speakerSet.values()).slice(0, 12);

    const speakerLinesZh = speakers.map((s) => {
      const name = s.name;
      const org = s.organization || "";
      const title = s.title || "";
      return `- ${name}${org ? `，${org}` : ""}${title ? `，${title}` : ""}`;
    });

    const speakerLinesEn = speakers.map((s) => {
      const name = s.nameEn || s.name;
      const org = s.organizationEn || s.organization || "";
      const title = s.titleEn || s.title || "";
      return `- ${name}${org ? `, ${org}` : ""}${title ? `, ${title}` : ""}`;
    });

    const [zhHighlights, enHighlights] = await Promise.all([
      generateHighlightsWithOpenAI({
        apiKey,
        model,
        locale: "zh",
        title: activity.title,
        description: activity.description || "",
        agendaLines: agendaLinesZh,
        speakerLines: speakerLinesZh,
        count,
      }).catch(() => [] as string[]),
      generateHighlightsWithOpenAI({
        apiKey,
        model,
        locale: "en",
        title: activity.titleEn || activity.title,
        description: activity.descriptionEn || activity.description || "",
        agendaLines: agendaLinesEn,
        speakerLines: speakerLinesEn,
        count,
      }).catch(() => [] as string[]),
    ]);

    if (zhHighlights.length > 0 || enHighlights.length > 0) {
      await (prisma.activity.update as any)({
        where: { id: activityId },
        data: {
          ...(zhHighlights.length > 0 && { highlights: zhHighlights }),
          ...(enHighlights.length > 0 && { highlightsEn: enHighlights }),
        },
      });
    }
  } catch (error) {
    console.error("[activity-highlights] Auto-generation failed:", error);
    // Non-fatal: do not throw
  }
}
