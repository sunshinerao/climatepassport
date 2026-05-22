"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-content";

export function LogoutButton({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace(`/${locale}/auth/login`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button className="button-secondary nav-action" disabled={isSubmitting} onClick={handleLogout} type="button">
      {isSubmitting ? "..." : label}
    </button>
  );
}
