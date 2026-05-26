"use client";

import { useEffect, useState } from "react";
import { CertificateCategoryForm } from "@/components/admin-certificate-config-forms";
import {
  CertificateAdminCategories,
  type CertificateAdminCategory,
} from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

type Props = {
  locale: Locale;
  categories: CertificateAdminCategory[];
};

export function CertificateAdminCategoriesClient({ locale, categories: serverCategories }: Props) {
  const [categories, setCategories] = useState(serverCategories);

  // Sync local state when server re-renders (e.g. after router.refresh())
  useEffect(() => {
    setCategories(serverCategories);
  }, [serverCategories]);

  function handleCategorySaved(saved: CertificateAdminCategory) {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      return exists
        ? prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c))
        : [...prev, saved];
    });
  }

  return (
    <CertificateAdminCategories
      locale={locale}
      categories={categories}
      form={(selectedCategory, clearSelection) => (
        <CertificateCategoryForm
          categories={categories}
          initialCategory={selectedCategory ?? undefined}
          locale={locale}
          onCancelEdit={clearSelection}
          onSaved={handleCategorySaved}
        />
      )}
    />
  );
}
