import type { ReactNode } from "react";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default function LocalizedAuthLayout({ children }: { children: ReactNode }) {
  return children;
}
