/**
 * Amazon SES mailer for verification and password reset.
 * Never fakes a send. If SES is not configured, returns configured:false.
 */
export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function sesConfigured(): boolean {
  return Boolean(process.env.SES_FROM_EMAIL?.trim());
}

export async function sendTransactionalEmail(payload: MailPayload): Promise<{ sent: boolean }> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("[email] SES_FROM_EMAIL is not set — not sending");
    return { sent: false };
  }
  const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
  const client = new SESv2Client({ region });
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [payload.to] },
      Content: {
        Simple: {
          Subject: { Data: payload.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: payload.text, Charset: "UTF-8" },
            ...(payload.html ? { Html: { Data: payload.html, Charset: "UTF-8" } } : {}),
          },
        },
      },
    }),
  );
  return { sent: true };
}
