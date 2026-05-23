import { redirect } from "next/navigation";

export default function AdminCertificateTemplateDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/en/admin/certificates/templates/${params.id}`);
}
