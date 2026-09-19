import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import QRCode from "qrcode";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadRenderer(overrides = {}) {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-pdf-renderer.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require, process, Buffer, fetch: overrides.fetch ?? fetch, AbortController, setTimeout, clearTimeout, Number, Error };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

test("HTTP renderer receives authenticated self-contained HTML and rejects insecure endpoints", async () => {
  const previous = {
    mode: process.env.CERTIFICATE_PDF_RENDERER,
    url: process.env.CERTIFICATE_PDF_RENDERER_URL,
    authorization: process.env.CERTIFICATE_PDF_RENDERER_AUTHORIZATION,
  };
  const calls = [];
  const pdfBytes = Uint8Array.from(Buffer.from("%PDF-test"));
  const { renderCertificatePdf } = loadRenderer({
    fetch: async (...args) => {
      calls.push(args);
      return { ok: true, status: 200, arrayBuffer: async () => pdfBytes.buffer };
    },
  });
  process.env.CERTIFICATE_PDF_RENDERER = "http";
  process.env.CERTIFICATE_PDF_RENDERER_AUTHORIZATION = "Bearer renderer-secret";
  try {
    process.env.CERTIFICATE_PDF_RENDERER_URL = "http://renderer.test/render";
    await assert.rejects(
      renderCertificatePdf("<!doctype html><html><head></head><body>证书</body></html>", { widthMm: 210, heightMm: 297 }),
      /HTTPS URL/,
    );
    assert.equal(calls.length, 0);

    process.env.CERTIFICATE_PDF_RENDERER_URL = "https://renderer.test/render";
    const result = await renderCertificatePdf("<!doctype html><html><head></head><body>气候证书</body></html>", { widthMm: 210, heightMm: 297 });
    assert.equal(result.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "https://renderer.test/render");
    assert.equal(calls[0][1].headers.authorization, "Bearer renderer-secret");
    const payload = JSON.parse(calls[0][1].body);
    assert.deepEqual(payload.page, { widthMm: 210, heightMm: 297 });
    assert.match(payload.html, /data-certificate-fonts/);
    assert.match(payload.html, /data:font\/woff2;base64,/);
    assert.doesNotMatch(payload.html, /\.\/files\/noto-sans-sc/);
  } finally {
    if (previous.mode === undefined) delete process.env.CERTIFICATE_PDF_RENDERER;
    else process.env.CERTIFICATE_PDF_RENDERER = previous.mode;
    if (previous.url === undefined) delete process.env.CERTIFICATE_PDF_RENDERER_URL;
    else process.env.CERTIFICATE_PDF_RENDERER_URL = previous.url;
    if (previous.authorization === undefined) delete process.env.CERTIFICATE_PDF_RENDERER_AUTHORIZATION;
    else process.env.CERTIFICATE_PDF_RENDERER_AUTHORIZATION = previous.authorization;
  }
});

function parsePdfInfo(bytes, directory, fileName) {
  const pdfPath = path.join(directory, fileName);
  fs.writeFileSync(pdfPath, bytes);
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const pageSize = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(info);
  assert.ok(pageSize, `Missing page size in pdfinfo output:\n${info}`);
  return {
    pdfPath,
    info,
    widthPts: Number(pageSize[1]),
    heightPts: Number(pageSize[2]),
  };
}

function assertNear(actual, expected, tolerance = 2) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("font embedding selects self-contained Noto Sans SC subsets", async () => {
  const { embedCertificateFonts } = loadRenderer();
  const html = "<!doctype html><html><head></head><body>气候行动证书 Climate Credential</body></html>";
  const embedded = await embedCertificateFonts(html);
  assert.match(embedded, /<style data-certificate-fonts>/);
  assert.match(embedded, /font-family:\s*'Noto Sans SC Variable'/);
  assert.match(embedded, /url\(data:font\/woff2;base64,/);
  assert.doesNotMatch(embedded, /url\(\.\/files\//);
  const faceCount = (embedded.match(/@font-face/g) ?? []).length;
  assert.ok(faceCount >= 2, `Expected Latin and Chinese subsets, received ${faceCount}`);
  assert.ok(faceCount < 20, `Expected subset selection, received ${faceCount} font faces`);
  assert.equal(await embedCertificateFonts(embedded), embedded);
});

test("renderer honors landscape, portrait, and digital-card physical page sizes", { timeout: 30_000 }, async () => {
  const previousMode = process.env.CERTIFICATE_PDF_RENDERER;
  process.env.CERTIFICATE_PDF_RENDERER = "playwright";
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "certificate-pdf-sizes-"));
  try {
    const { renderCertificatePdf } = loadRenderer();
    const cases = [
      { name: "landscape.pdf", widthMm: 297, heightMm: 210 },
      { name: "portrait.pdf", widthMm: 210, heightMm: 297 },
      { name: "digital-card.pdf", widthMm: 210, heightMm: 132 },
    ];
    for (const item of cases) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${item.widthMm}mm ${item.heightMm}mm;margin:0}html,body{margin:0}.certificate{width:${item.widthMm}mm;height:${item.heightMm}mm;overflow:hidden;background:#fff}h1{margin:12mm}</style></head><body><main class="certificate"><h1>气候行动证书</h1></main></body></html>`;
      const bytes = await renderCertificatePdf(html, item);
      const result = parsePdfInfo(bytes, directory, item.name);
      assert.match(result.info, /Pages:\s+1/);
      assertNear(result.widthPts, item.widthMm * 72 / 25.4);
      assertNear(result.heightPts, item.heightMm * 72 / 25.4);
    }
  } finally {
    process.env.CERTIFICATE_PDF_RENDERER = previousMode;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Chromium renderer produces a single-page borderless PDF with Chinese text and QR graphics", { timeout: 30_000 }, async () => {
  const previousMode = process.env.CERTIFICATE_PDF_RENDERER;
  process.env.CERTIFICATE_PDF_RENDERER = "playwright";
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "certificate-pdf-render-"));
  try {
    const { renderCertificatePdf } = loadRenderer();
    const verificationUrl = "https://passport.test/verify/certificate/CV-PDF-QR-001";
    const qr = await QRCode.toString(verificationUrl, { type: "svg", margin: 1 });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:297mm 210mm;margin:0}html,body{margin:0}.certificate{width:297mm;height:210mm;background:#fff;overflow:hidden}.qr{width:35mm;height:35mm}</style></head><body><main class="certificate"><h1>气候行动证书</h1><p>持有人：王小明 Long Holder Name</p><div class="qr">${qr}</div></main></body></html>`;
    const bytes = await renderCertificatePdf(html, { widthMm: 297, heightMm: 210 });
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(bytes.length > 5_000);

    const { pdfPath, info } = parsePdfInfo(bytes, directory, "certificate.pdf");
    assert.match(info, /Pages:\s+1/);
    assert.match(info, /Page size:\s+84[01](?:\.\d+)? x 59[45](?:\.\d+)? pts/);
    execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-png", "-r", "144", pdfPath, path.join(directory, "certificate")]);
    assert.ok(fs.statSync(path.join(directory, "certificate.png")).size > 2_000);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(path.join(directory, "certificate.png")).toString());
      const result = await page.evaluate(async () => {
        const image = document.querySelector("img");
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonWhitePixels = 0;
        for (let index = 0; index < pixels.length; index += 16) {
          if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) nonWhitePixels += 1;
        }
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        return {
          decoded: (await detector.detect(image)).map((code) => code.rawValue),
          nonWhitePixels,
        };
      });
      assert.ok(result.nonWhitePixels > 1_000, `Expected rendered content, found ${result.nonWhitePixels} sampled non-white pixels`);
      assert.deepEqual(result.decoded, [verificationUrl]);
    } finally {
      await browser.close();
    }
  } finally {
    process.env.CERTIFICATE_PDF_RENDERER = previousMode;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
