import { redirect } from "next/navigation";

export default function DashboardCertificateDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/en/dashboard/certificates/${params.id}`);
}
