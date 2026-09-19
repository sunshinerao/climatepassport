import { readFile } from "node:fs/promises";
import path from "node:path";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const FONT_FAMILY = "Noto Sans SC Variable";
const FONT_STYLE_MARKER = "data-certificate-fonts";

type PdfPage = { widthMm: number; heightMm: number };
type UnicodeRange = { start: number; end: number };
type FontFaceSource = { css: string; filePath: string; ranges: UnicodeRange[] };

let fontFaceSourcesPromise: Promise<FontFaceSource[]> | null = null;
const encodedFontCache = new Map<string, Promise<string>>();

async function readBundledFontCss() {
  const relativePath = path.join("node_modules", "@fontsource-variable", "noto-sans-sc", "index.css");
  let currentDirectory = process.cwd();
  const attempted: string[] = [];
  for (let depth = 0; depth < 5; depth += 1) {
    const cssPath = path.join(currentDirectory, relativePath);
    attempted.push(cssPath);
    try {
      return { cssPath, css: await readFile(cssPath, "utf8") };
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(currentDirectory);
    if (parent === currentDirectory) break;
    currentDirectory = parent;
  }
  throw new Error(`Bundled certificate font CSS was not found in ${attempted.length} allowed locations.`);
}

function parseUnicodeRanges(value: string) {
  return value.split(",").map((entry) => entry.trim()).flatMap((entry): UnicodeRange[] => {
    const match = /^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i.exec(entry);
    if (!match) return [];
    if (match[1].includes("?")) {
      return [{
        start: Number.parseInt(match[1].replaceAll("?", "0"), 16),
        end: Number.parseInt(match[1].replaceAll("?", "f"), 16),
      }];
    }
    const start = Number.parseInt(match[1], 16);
    return [{ start, end: match[2] ? Number.parseInt(match[2], 16) : start }];
  });
}

async function loadFontFaceSources() {
  if (!fontFaceSourcesPromise) {
    fontFaceSourcesPromise = (async () => {
      const { cssPath, css } = await readBundledFontCss();
      return Array.from(css.matchAll(/@font-face\s*\{[\s\S]*?\}/g)).flatMap((match): FontFaceSource[] => {
        const source = /src:\s*url\(([^)]+)\)/.exec(match[0]);
        const ranges = /unicode-range:\s*([^;]+);/.exec(match[0]);
        if (!source || !ranges) return [];
        return [{
          css: match[0],
          filePath: path.resolve(path.dirname(cssPath), source[1].replace(/^['"]|['"]$/g, "")),
          ranges: parseUnicodeRanges(ranges[1]),
        }];
      });
    })();
  }
  return fontFaceSourcesPromise;
}

function containsRenderedCodePoint(ranges: UnicodeRange[], codePoints: Set<number>) {
  for (const codePoint of codePoints) {
    if (ranges.some((range) => codePoint >= range.start && codePoint <= range.end)) return true;
  }
  return false;
}

function encodeFont(filePath: string) {
  let encoded = encodedFontCache.get(filePath);
  if (!encoded) {
    encoded = readFile(filePath).then((bytes) => bytes.toString("base64"));
    encodedFontCache.set(filePath, encoded);
  }
  return encoded;
}

export async function embedCertificateFonts(html: string) {
  if (html.includes(FONT_STYLE_MARKER)) return html;
  const codePoints = new Set(Array.from(html, (character) => character.codePointAt(0) as number));
  const matchingFaces = (await loadFontFaceSources()).filter((face) => containsRenderedCodePoint(face.ranges, codePoints));
  const embeddedFaces = await Promise.all(matchingFaces.map(async (face) => {
    const encoded = await encodeFont(face.filePath);
    return face.css
      .replace(/font-display:\s*swap/, "font-display: block")
      .replace(/url\([^)]+\)/, `url(data:font/woff2;base64,${encoded})`);
  }));
  if (!embeddedFaces.length) throw new Error("Certificate PDF font subsets could not be resolved.");
  const style = `<style ${FONT_STYLE_MARKER}>${embeddedFaces.join("\n")}html,body{font-family:'${FONT_FAMILY}',Arial,sans-serif}</style>`;
  if (!html.includes("</head>")) throw new Error("Certificate PDF HTML is missing a head element.");
  return html.replace("</head>", `${style}</head>`);
}

function rendererMode() {
  const configured = process.env.CERTIFICATE_PDF_RENDERER;
  if (configured === "playwright" || configured === "http") return configured;
  if (process.env.CP_TEST_ENV_ID === "climate-passport-isolated-test" || process.env.NODE_ENV === "development") return "playwright";
  throw new Error("CERTIFICATE_PDF_RENDERER must be configured as playwright or http.");
}

function timeoutMs() {
  const parsed = Number(process.env.CERTIFICATE_PDF_RENDER_TIMEOUT_MS ?? 20_000);
  return Number.isFinite(parsed) ? Math.min(60_000, Math.max(2_000, Math.round(parsed))) : 20_000;
}

function assertPdf(bytes: Buffer) {
  if (bytes.length < 5 || bytes.length > MAX_PDF_BYTES || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Certificate renderer returned an invalid or oversized PDF.");
  }
  return bytes;
}

async function renderWithHttp(html: string, page: PdfPage) {
  const endpoint = process.env.CERTIFICATE_PDF_RENDERER_URL;
  if (!endpoint || !/^https:\/\//.test(endpoint)) throw new Error("CERTIFICATE_PDF_RENDERER_URL must be an HTTPS URL.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/pdf",
        ...(process.env.CERTIFICATE_PDF_RENDERER_AUTHORIZATION ? { authorization: process.env.CERTIFICATE_PDF_RENDERER_AUTHORIZATION } : {}),
      },
      body: JSON.stringify({ html, page, printBackground: true }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Certificate PDF renderer failed (${response.status}).`);
    return assertPdf(Buffer.from(await response.arrayBuffer()));
  } finally {
    clearTimeout(timeout);
  }
}

async function renderWithPlaywright(html: string, pageSize: PdfPage) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.setDefaultTimeout(timeoutMs());
    await page.setContent(html, { waitUntil: "load", timeout: timeoutMs() });
    await page.evaluate(async () => {
      await document.fonts?.ready;
      await Promise.all(Array.from(document.images).map((image) => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => reject(new Error("Certificate image failed to load.")), { once: true });
          })));
    });
    await page.emulateMedia({ media: "print" });
    const bytes = await page.pdf({
      width: `${pageSize.widthMm}mm`,
      height: `${pageSize.heightMm}mm`,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    });
    return assertPdf(Buffer.from(bytes));
  } finally {
    await browser.close();
  }
}

export async function renderCertificatePdf(html: string, page: PdfPage) {
  if (!Number.isFinite(page.widthMm) || !Number.isFinite(page.heightMm) || page.widthMm < 80 || page.heightMm < 80 || page.widthMm > 1200 || page.heightMm > 1200) {
    throw new Error("Certificate PDF page dimensions are invalid.");
  }
  const selfContainedHtml = await embedCertificateFonts(html);
  return rendererMode() === "http" ? renderWithHttp(selfContainedHtml, page) : renderWithPlaywright(selfContainedHtml, page);
}
