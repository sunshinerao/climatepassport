"use client";

interface ActivityPosterData {
  title: string;
  titleEn?: string | null;
  subtitle?: string | null;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  venue?: string | null;
  address?: string | null;
  city?: string | null;
  organizerName?: string | null;
  posterImage?: string | null;
  slug: string;
  locale: string;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split("");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function buildSharePoster(activity: ActivityPosterData): Promise<string> {
  const W = 1080;
  const H = 1520;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#1e293b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative circles
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.15, 120, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(22, 163, 74, 0.15)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.85, 180, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(14, 165, 233, 0.1)";
  ctx.fill();

  // Top label
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#16a34a";
  ctx.textAlign = "center";
  ctx.fillText("SHANGHAI CLIMATE WEEK 2026", W / 2, 80);

  // Title
  const title = activity.locale === "zh" ? activity.title : (activity.titleEn ?? activity.title);
  ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const titleLines = wrapText(ctx, title, W - 120);
  let y = 200;
  for (const line of titleLines.slice(0, 4)) {
    ctx.fillText(line, W / 2, y);
    y += 68;
  }

  // Date & time
  y += 40;
  if (activity.startTime) {
    const start = new Date(activity.startTime);
    const dateStr = start.toLocaleDateString(activity.locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric", month: "long", day: "numeric",
      timeZone: activity.timezone ?? "Asia/Shanghai",
    });
    ctx.font = "32px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`📅 ${dateStr}`, W / 2, y);
    y += 60;
  }

  // Venue
  if (activity.venue || activity.city) {
    const venueStr = [activity.city, activity.venue].filter(Boolean).join(" · ");
    ctx.font = "28px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`📍 ${venueStr}`, W / 2, y);
    y += 60;
  }

  // Organizer
  if (activity.organizerName) {
    ctx.font = "26px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`🏢 ${activity.organizerName}`, W / 2, y);
    y += 60;
  }

  // QR code area
  y += 60;
  const qrSize = 280;
  const qrX = (W - qrSize) / 2;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    `${window.location.origin}/${activity.locale}/activities/${activity.slug}`
  )}`;

  const qrImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = qrUrl;
  });

  if (qrImg.complete && qrImg.naturalWidth > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(qrX - 16, y - 16, qrSize + 32, qrSize + 32, 16);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, y, qrSize, qrSize);
  }

  y += qrSize + 60;

  // Bottom text
  ctx.font = "24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(
    activity.locale === "zh" ? "扫码查看详情 · 立即报名" : "Scan to view details & register",
    W / 2,
    y
  );

  return canvas.toDataURL("image/png");
}

export async function buildEventPoster(activity: ActivityPosterData): Promise<string> {
  const W = 1240;
  const PADDING = 60;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Pre-measure content height
  const title = activity.locale === "zh" ? activity.title : (activity.titleEn ?? activity.title);
  ctx.font = "bold 48px system-ui, -apple-system, sans-serif";
  const titleLines = wrapText(ctx, title, W - PADDING * 2);

  let contentHeight = PADDING + 60; // header
  contentHeight += titleLines.length * 64 + 40;

  if (activity.startTime) {
    contentHeight += 50;
  }
  if (activity.venue || activity.city) {
    contentHeight += 50;
  }
  if (activity.organizerName) {
    contentHeight += 50;
  }
  contentHeight += 60; // QR area
  contentHeight += 280; // QR
  contentHeight += PADDING;

  const H = Math.max(1754, contentHeight); // A4 @ 150dpi
  canvas.width = W;
  canvas.height = H;

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Top banner
  const bannerGrad = ctx.createLinearGradient(0, 0, W, 200);
  bannerGrad.addColorStop(0, "#0f766e");
  bannerGrad.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = bannerGrad;
  ctx.fillRect(0, 0, W, 180);

  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "left";
  ctx.fillText("SHANGHAI CLIMATE WEEK 2026", PADDING, 50);

  // Title
  ctx.font = "bold 48px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#111827";
  ctx.textAlign = "left";
  let y = 240;
  for (const line of titleLines.slice(0, 5)) {
    ctx.fillText(line, PADDING, y);
    y += 64;
  }

  y += 30;

  // Info section
  ctx.font = "28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#374151";

  if (activity.startTime) {
    const start = new Date(activity.startTime);
    const dateStr = start.toLocaleDateString(activity.locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: activity.timezone ?? "Asia/Shanghai",
    });
    ctx.fillText(`📅 ${dateStr}`, PADDING, y);
    y += 50;
  }

  if (activity.venue || activity.city) {
    const venueStr = [activity.city, activity.venue, activity.address].filter(Boolean).join(" · ");
    ctx.fillText(`📍 ${venueStr}`, PADDING, y);
    y += 50;
  }

  if (activity.organizerName) {
    ctx.fillText(`🏢 ${activity.organizerName}`, PADDING, y);
    y += 50;
  }

  y += 40;

  // Divider
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(W - PADDING, y);
  ctx.stroke();
  y += 50;

  // QR code
  const qrSize = 240;
  const qrX = (W - qrSize) / 2;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    `${window.location.origin}/${activity.locale}/activities/${activity.slug}`
  )}`;

  const qrImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = qrUrl;
  });

  if (qrImg.complete && qrImg.naturalWidth > 0) {
    ctx.fillStyle = "#f9fafb";
    ctx.beginPath();
    ctx.roundRect(qrX - 20, y - 20, qrSize + 40, qrSize + 80, 12);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, y, qrSize, qrSize);

    ctx.font = "22px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";
    ctx.fillText(
      activity.locale === "zh" ? "扫码报名 · 查看详情" : "Scan to register",
      W / 2,
      y + qrSize + 50
    );
  }

  return canvas.toDataURL("image/png");
}
