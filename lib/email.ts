import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "Password reset requested but SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).",
    );
    return false;
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@lakisa.example";
  await transporter.sendMail({
    from: `Lakisa <${from}>`,
    to,
    subject: "Reset your Lakisa password",
    text: `Hello,\n\nYou asked to reset your Lakisa password. Use this link (it expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email.\n\n— Lakisa`,
    html: `<p>Hello,</p><p>You asked to reset your Lakisa password. Use this link (it expires in 1 hour):</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you didn't ask for this, you can ignore this email.</p><p>— Lakisa</p>`,
  });
  return true;
}
