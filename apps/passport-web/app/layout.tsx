import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Climate Passport Platform",
  description: "Climate Passport core platform for identity, participation, and certificates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, "Noto Sans SC", "Source Han Sans SC", "PingFang SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}