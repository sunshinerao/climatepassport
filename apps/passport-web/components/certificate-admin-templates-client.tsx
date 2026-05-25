"use client";

import { CertificateTemplateForm } from "@/components/admin-certificate-config-forms";
import {
  CertificateAdminTemplates,
  type CertificateAdminTemplate,
} from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

type CategoryOption = {
  id: string;
  key: string;
  name: string;
  nameEn?: string | null;
};

type Props = {
  locale: Locale;
  templates: CertificateAdminTemplate[];
  categories: CategoryOption[];
};

export function CertificateAdminTemplatesClient({ locale, templates, categories }: Props) {
  return (
    <CertificateAdminTemplates
      locale={locale}
      templates={templates}
      form={(selectedTemplate, clearSelection) => (
        <CertificateTemplateForm
          categories={categories}
          initialTemplate={selectedTemplate ?? undefined}
          locale={locale}
          onCancelEdit={clearSelection}
        />
      )}
    />
  );
}
