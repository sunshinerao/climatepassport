"use client";

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

export function CertificateAdminCategoriesClient({ locale, categories }: Props) {
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
        />
      )}
    />
  );
}
