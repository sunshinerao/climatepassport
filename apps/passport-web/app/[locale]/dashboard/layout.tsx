import type { ReactNode } from "react";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default function LocalizedDashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
