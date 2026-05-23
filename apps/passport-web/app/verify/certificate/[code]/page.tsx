import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import {
  formatCertificateDate,
  getCertificateName,
  getCertificateIssueForPublicVerification,
  serializePublicHolder,
} from "@/lib/server/certificate-module";

export default async function PublicCertificateVerificationPage({ params }: { params: { code: string } }) {
  noStore();
  const issue = await getCertificateIssueForPublicVerification(params.code.trim());
  const verifiedAt = new Date();

  if (!issue) {
    return (
      <section className="certificate-verify-page">
        <div className="certificate-verify-result invalid">
          <span className="label">Credential Verification</span>
          <h1>Certificate not found</h1>
          <p>The verification link is invalid or the certificate does not exist in Climate Passport.</p>
          <Link className="button-outline" href="/en">Return to Climate Passport</Link>
        </div>
      </section>
    );
  }

  const holder = serializePublicHolder(issue.user);
  const status = issue.status === "REVOKED" ? "Revoked" : issue.status === "ISSUED" ? "Valid" : "Invalid";
  const isValid = status === "Valid";

  return (
    <section className="certificate-verify-page">
      <div className={`certificate-verify-result ${isValid ? "valid" : "invalid"}`}>
        <span className="label">Climate Passport Trusted Verification</span>
        <h1>{status}</h1>
        <p>
          {isValid
            ? "This credential was issued by Climate Passport and can be independently verified."
            : "This credential is not currently valid for public verification."}
        </p>
      </div>

      <div className="certificate-verify-grid">
        <article className="panel">
          <span className="label">Certificate</span>
          <h2>{getCertificateName("en", issue.definition)}</h2>
          <dl className="certificate-meta-list">
            <div>
              <dt>Holder</dt>
              <dd>{holder.name}</dd>
            </div>
            <div>
              <dt>Masked Passport ID</dt>
              <dd>{holder.maskedPassportId || "Not disclosed"}</dd>
            </div>
            <div>
              <dt>Issuer</dt>
              <dd>Climate Passport</dd>
            </div>
            <div>
              <dt>Issue date</dt>
              <dd>{formatCertificateDate("en", issue.issuedAt ?? issue.createdAt)}</dd>
            </div>
            <div>
              <dt>Certificate number</dt>
              <dd>{issue.verificationCode}</dd>
            </div>
            <div>
              <dt>Credential type</dt>
              <dd>{getCertificateName("en", issue.definition.category)}</dd>
            </div>
            <div>
              <dt>Related source</dt>
              <dd>{issue.sourceType ?? "Climate Passport record"}</dd>
            </div>
            <div>
              <dt>Verified at</dt>
              <dd>{formatCertificateDate("en", verifiedAt)}</dd>
            </div>
          </dl>
        </article>

        <aside className="panel">
          <span className="label">Privacy Notice</span>
          <h2>Minimum disclosure</h2>
          <p>
            This page verifies the credential, not the full person. It does not disclose email, phone,
            government ID, date of birth, application materials, admin notes, or private Passport records.
          </p>
          <div className="button-row">
            <Link className="button" href="/en/certificates">About certificates</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
