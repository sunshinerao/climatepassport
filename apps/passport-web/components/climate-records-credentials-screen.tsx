import Link from "next/link";

const contents = [
  { href: "#climate-credentials", label: "What are climate credentials?" },
  { href: "#credential-verification", label: "How verification works" },
  { href: "#climate-learning-records", label: "Climate learning records" },
  { href: "#climate-participation-records", label: "Climate participation records" },
  { href: "#climate-action-records", label: "Climate action records" },
  { href: "#climate-digital-identity", label: "Climate digital identity" },
  { href: "#how-climate-passport-connects-records", label: "How Climate Passport connects records" },
];

export const climateRecordsHubTitle = "Climate Records & Credentials | Climate Passport";
export const climateRecordsHubDescription =
  "A practical guide to climate credentials, verification, learning records, participation records, action records and climate digital identity.";
export const climateRecordsHubPath = "/climate-records-and-credentials";

export function ClimateRecordsCredentialsScreen() {
  return (
    <>
      <div className="section-header knowledge-hub-header">
        <div>
          <span className="label">Climate Passport Knowledge Hub</span>
          <h1>Climate Records and Credentials: A Practical Guide</h1>
        </div>
        <p>
          Climate-related learning, participation, credentials and action are often recorded by different organizations and stored in separate formats. This guide explains the main types of climate records, how verification works, and how these records can contribute to a more portable and persistent digital profile.
        </p>
      </div>

      <section className="section privacy-policy-content knowledge-hub-content" aria-labelledby="knowledge-hub-contents">
        <nav className="panel knowledge-hub-nav" aria-labelledby="knowledge-hub-contents">
          <h2 id="knowledge-hub-contents">Contents</h2>
          <ul>
            {contents.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="panel privacy-policy-section knowledge-hub-section" id="climate-credentials">
          <h2>What Are Climate Credentials?</h2>
          <p className="privacy-policy-lead">
            Climate credentials are records of climate-related learning, skills, participation or achievement issued or confirmed by an identifiable organization.
          </p>
          <p>
            A trustworthy climate credential should make it possible to understand who issued the record, what the credential represents, who received it, when it was issued where relevant, and how its authenticity or issuance record can be checked.
          </p>
          <p>
            The term is useful for describing climate-related records, but it should not be treated as a universally standardized legal category. A credential may be issued by a university, event organizer, professional programme, civil society initiative or other identifiable organization, depending on the context.
          </p>
          <h3>What a climate credential can represent</h3>
          <p>
            A credential can represent completion of a learning activity, participation in an eligible event, contribution to a programme, receipt of a certificate, or another recognized climate-related outcome. Its meaning depends on the issuer and the record attached to it.
          </p>
          <h3>Issuer, recipient and meaning</h3>
          <p>
            Issuer identity, recipient identity and credential meaning are central to interpretation. A reader should be able to distinguish a record issued by an institution from a self-declared statement, and should be able to understand what the record confirms.
          </p>
          <p>
            Climate Passport uses a <Link href="/en/climate-passport-id">Climate Passport ID</Link> as a profile anchor for supported records. For broader context, see <Link href="/en/about">what Climate Passport is</Link>.
          </p>
        </article>

        <article className="panel privacy-policy-section knowledge-hub-section" id="credential-verification">
          <h2>How Can Climate Credentials Be Verified?</h2>
          <p className="privacy-policy-lead">
            Climate credentials can be verified by checking the issuer, recipient, credential identifier, issuance record and the verification information provided by the issuing system.
          </p>
          <p>
            A useful verification process helps a third party confirm that the credential exists as an issued record and is not simply an unsupported image, screenshot or copied document. It should give enough context to understand where the record came from and what it means.
          </p>
          <p>
            A certificate image is not automatically the same as a verifiable credential record. Visual documents can represent a valid credential, but verification requires access to appropriate issuer information, issuance information or a verification system.
          </p>
          <h3>Common verification signals</h3>
          <ul className="privacy-policy-list">
            <li>Issuer identity and issuing organization context</li>
            <li>Recipient identity or profile context where appropriate</li>
            <li>Credential identifier, verification code or record identifier</li>
            <li>Issuance record and issue date where relevant</li>
            <li>Verification page or verification system</li>
            <li>Status or revocation information where supported</li>
          </ul>
        </article>

        <article className="panel privacy-policy-section knowledge-hub-section" id="climate-learning-records">
          <h2>What Is a Climate Learning Record?</h2>
          <p className="privacy-policy-lead">
            A climate learning record is a structured record of an individual climate-related learning experience.
          </p>
          <p>
            It may document participation in a course, workshop, summer school, professional programme, learning module or another eligible climate-related learning activity.
          </p>
          <p>
            Climate learning can take place across universities, academies, professional programmes, events and other organizations. The records are often stored by separate institutions and may use different formats.
          </p>
          <p>
            A learning record is not always the same as a certificate. A learning record may describe a learning experience even when a formal certificate is not issued. A certificate may be one type of credential associated with a learning experience.
          </p>
          <p>
            Climate Passport is designed to connect supported climate learning records to a persistent personal profile. It does not automatically import every climate course or learning activity in the world.
          </p>
        </article>

        <article className="panel privacy-policy-section knowledge-hub-section" id="climate-participation-records">
          <h2>How Can Climate Participation Be Digitally Recorded?</h2>
          <p className="privacy-policy-lead">
            Climate participation can be digitally recorded by connecting an identifiable participant with an eligible event, programme or activity and creating a structured attendance or participation record.
          </p>
          <p>
            Depending on the programme, a participation record may be supported by registration, digital check-in, QR-based check-in, organizer confirmation, attendance confirmation or another defined verification process.
          </p>
          <p>
            Registration is not automatically the same as verified participation. A person may register for an event but not attend. Attendance or participation records may therefore require additional confirmation depending on the programme.
          </p>
          <p>
            This distinction is important for event, registration, check-in and attendance workflows because it separates intent to participate from confirmed participation.
          </p>
        </article>

        <article className="panel privacy-policy-section knowledge-hub-section" id="climate-action-records">
          <h2>What Is a Climate Action Record?</h2>
          <p className="privacy-policy-lead">
            A climate action record is a structured digital record of an eligible climate-related activity or action associated with an individual or participating entity.
          </p>
          <p>
            The record may describe what took place, when it occurred, the programme or organization involved, the participant or entity associated with the action, how the activity was recorded or confirmed, and supporting evidence where appropriate.
          </p>
          <p>
            A climate action record does not automatically represent a quantified carbon reduction or verified climate impact. Impact claims require appropriate methodologies, data and verification.
          </p>
          <p>
            Recording an activity is different from measuring climate impact. An activity record can document participation or action, while impact measurement requires a defined methodology and evidence base.
          </p>
        </article>

        <article className="panel privacy-policy-section knowledge-hub-section" id="climate-digital-identity">
          <h2>What Is Climate Digital Identity?</h2>
          <p className="privacy-policy-lead">
            Climate digital identity is an emerging way of describing how personal climate-related learning, participation, credentials and action records can be connected within a persistent digital profile.
          </p>
          <p>
            Climate digital identity is not a government-issued identity or travel document. It is not a national identity credential or legal identity status.
          </p>
          <p>
            Instead of keeping learning records, participation records and credentials in disconnected systems, a persistent climate-focused digital profile can connect supported records over time. Useful language for this concept includes portable profile, persistent profile, records connected across supported programmes and shareable records where appropriate.
          </p>
          <p>
            Portability should be understood carefully. A profile can make supported records easier to carry and share, but it does not imply universal interoperability or global legal recognition.
          </p>
          <p>
            <Link href="/en/about">Climate Passport</Link> uses the concept of climate digital identity to describe a portable digital profile focused on climate-related learning, participation, credentials and action records. A <Link href="/en/climate-passport-id">Climate Passport ID</Link> provides the profile anchor for supported workflows.
          </p>
        </article>

        <article className="panel privacy-policy-section knowledge-hub-section" id="how-climate-passport-connects-records">
          <h2>How Climate Passport Connects These Records</h2>
          <p className="privacy-policy-lead">
            Climate Passport connects supported records by associating them with a persistent profile and Climate Passport ID through eligible platform workflows.
          </p>
          <ol className="privacy-policy-list">
            <li>A person creates a Climate Passport profile.</li>
            <li>The profile is associated with a unique Climate Passport ID.</li>
            <li>Supported learning, participation, credential or action records can be connected to the profile.</li>
            <li>Authorized or relevant organizations may create, confirm or issue records through supported workflows.</li>
            <li>The individual can build a more continuous and portable climate-era digital profile over time.</li>
          </ol>
          <p>
            The model depends on supported records, supported workflows, eligible programmes and issuing organizations that provide the relevant record. Where verification is available, it should help confirm the issuer, recipient, status and meaning of the record.
          </p>
          <p>
            Climate Passport is not a government identity, a UN identity or a travel passport. It does not mean every climate credential is recognized by the platform, every employer trusts the record, every record is blockchain-backed or every activity is a verified climate impact.
          </p>
          <p>
            <Link href="/en/about">Learn more about what Climate Passport is</Link> and how it defines its identity boundary. You can also read <Link href="/en/climate-passport-id">what a Climate Passport ID is</Link>.
          </p>
        </article>

        <section className="panel privacy-policy-section knowledge-hub-section" aria-labelledby="related-concepts">
          <h2 id="related-concepts">Related Concepts</h2>
          <ul className="privacy-policy-list">
            <li><Link href="/en/about">What is Climate Passport?</Link></li>
            <li><Link href="/en/climate-passport-id">What is a Climate Passport ID?</Link></li>
            <li><a href="#climate-credentials">Climate credentials</a></li>
            <li><a href="#credential-verification">Credential verification</a></li>
            <li><a href="#climate-digital-identity">Climate digital identity</a></li>
          </ul>
        </section>
      </section>
    </>
  );
}