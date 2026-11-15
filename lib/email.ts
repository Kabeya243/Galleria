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
    text: `Hello,\n\nYou asked to reset your Lakisa password. Use this link (it expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email.\n\nLakisa`,
    html: `<p>Hello,</p><p>You asked to reset your Lakisa password. Use this link (it expires in 1 hour):</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you didn't ask for this, you can ignore this email.</p><p>Lakisa</p>`,
  });
  return true;
}

// Email verification (Nov 2026): sends the signup confirmation link.
// Returns false — without throwing — when SMTP is not configured, so
// the caller can tell the visitor the email could not be sent instead
// of failing the signup. The verification link itself is NEVER
// returned to the caller: it only ever travels inside this email.
// The explicit error log below is the server-side signal that SMTP
// needs configuring (SMTP_HOST / SMTP_USER / SMTP_PASS on Vercel);
// a missing SMTP setup must never fail silently now that signup
// depends on the email arriving.
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      "EMAIL NOT SENT: verification email for signup could not be sent — SMTP is not configured " +
        "(SMTP_HOST / SMTP_USER / SMTP_PASS missing). The account was created but stays unverified " +
        "until the email can be sent; set the SMTP variables on Vercel and use the resend link.",
    );
    return false;
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@lakisa.example";
  await transporter.sendMail({
    from: `Lakisa <${from}>`,
    to,
    subject: "Verify your Lakisa email",
    text: `Hello,\n\nWelcome to Lakisa! Please confirm your email address by opening this link (it expires in 24 hours):\n\n${verifyUrl}\n\nOnce verified, you can sign in and start building your gallery.\n\nIf you didn't create a Lakisa account, you can ignore this email.\n\nLakisa`,
    html: `<p>Hello,</p><p>Welcome to Lakisa! Please confirm your email address by opening the link below (it expires in 24 hours):</p><p><a href="${verifyUrl}">Verify my email</a></p><p>Once verified, you can sign in and start building your gallery.</p><p>If you didn't create a Lakisa account, you can ignore this email.</p><p>Lakisa</p>`,
  });
  return true;
}

// Open-call acknowledgement (Nov 2026): a short receipt sent to the
// applicant the moment their application is saved, from the public
// inbox hello@lakisa.art. Bilingual (English + French) because the
// calls are. Returns false — without throwing — when SMTP is not
// configured, so a missing mail setup never breaks the submission
// itself; the application is already stored either way.
export async function sendOpenCallAcknowledgementEmail(
  to: string,
  callTitle: string,
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;
  await transporter.sendMail({
    from: "Lakisa <hello@lakisa.art>",
    to,
    subject: `We received your application — ${callTitle}`,
    text:
      `Hello,\n\nThank you! We received your application for "${callTitle}". ` +
      `Our team will review it and get back to you.\n\n` +
      `Bonjour,\n\nMerci ! Nous avons bien reçu votre candidature pour "${callTitle}". ` +
      `Notre équipe va l'examiner et reviendra vers vous.\n\n` +
      `Lakisa\nhello@lakisa.art`,
    html:
      `<p>Hello,</p><p>Thank you! We received your application for "<strong>${callTitle}</strong>". ` +
      `Our team will review it and get back to you.</p>` +
      `<p>Bonjour,</p><p>Merci ! Nous avons bien reçu votre candidature pour "<strong>${callTitle}</strong>". ` +
      `Notre équipe va l'examiner et reviendra vers vous.</p>` +
      `<p>Lakisa<br><a href="mailto:hello@lakisa.art">hello@lakisa.art</a></p>`,
  });
  return true;
}

// New-message notification (Nov 2026): tells the recipient someone
// wrote to them on Lakisa, with a short excerpt and a link to the
// conversation. Returns false — without throwing — when SMTP is not
// configured, so a missing mail setup never breaks sending the
// message itself; the message is already stored and visible in the
// inbox either way.
export async function sendNewMessageEmail(
  to: string,
  senderName: string,
  excerpt: string,
  conversationUrl: string,
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@lakisa.example";
  const short = excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt;
  await transporter.sendMail({
    from: `Lakisa <${from}>`,
    to,
    subject: `New message from ${senderName} on Lakisa`,
    text: `Hello,\n\n${senderName} sent you a message on Lakisa:\n\n"${short}"\n\nRead and reply here:\n\n${conversationUrl}\n\nLakisa`,
    html: `<p>Hello,</p><p><strong>${senderName}</strong> sent you a message on Lakisa:</p><blockquote>${short}</blockquote><p><a href="${conversationUrl}">Read and reply</a></p><p>Lakisa</p>`,
  });
  return true;
}
