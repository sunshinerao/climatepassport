import { Resend } from "resend";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

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
  if (process.env.CP_TEST_ENV_ID === "climate-passport-isolated-test" && process.env.MAIL_TRANSPORT === "test-outbox") {
    const configuredPath = process.env.MAIL_TEST_OUTBOX_PATH;
    if (!configuredPath) throw new Error("MAIL_TEST_OUTBOX_PATH is required for the test outbox transport.");
    const outboxPath = path.resolve(configuredPath);
    await mkdir(path.dirname(outboxPath), { recursive: true });
    await appendFile(outboxPath, `${JSON.stringify({ sentAt: new Date().toISOString(), ...options })}\n`, { encoding: "utf8", mode: 0o600 });
    return;
  }

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
