import { Resend } from "resend";

type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getMailerConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "Climate Passport <no-reply@notice.climatepass.org>";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return { apiKey, from };
}

export async function sendTransactionalMail(options: SendMailOptions) {
  const { apiKey, from } = getMailerConfig();
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}
