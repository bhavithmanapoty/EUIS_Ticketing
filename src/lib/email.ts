import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import QRCode from "qrcode";

const SENDER_NAME = "Edinburgh University Indian Society";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * One transporter per request. Serverless instances don't keep SMTP pools
 * alive between invocations, so pooling/rate options would do nothing.
 */
export function createMailer() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set");
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") },
  });
}

export async function sendTicketEmail(
  mailer: Transporter,
  opts: { to: string; name: string; eventName: string; token: string }
) {
  const qr = await QRCode.toBuffer(opts.token, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
  const name = escapeHtml(opts.name);
  const eventName = escapeHtml(opts.eventName);

  // Must be awaited: Vercel freezes the function once the response is sent.
  await mailer.sendMail({
    from: { name: SENDER_NAME, address: process.env.GMAIL_USER! },
    to: opts.to,
    subject: `Your ticket for ${opts.eventName}`,
    text: `Hi ${opts.name}, here is your ticket for the ${opts.eventName}. Please present this QR code at the entry desk to check in.\n\nYour QR code is attached as ticket.png.`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Hi ${name},</p>
<p>Here is your ticket for the ${eventName}. Please present this QR code at the entry desk to check in.</p>
<p><img src="cid:ticket-qr" alt="Your ticket QR code" width="280" height="280" style="display:block;width:280px;height:280px"></p>
<p style="color:#555;font-size:14px">The QR code is also attached as ticket.png.</p>
</div>`,
    attachments: [
      { filename: "ticket-qr.png", content: qr, cid: "ticket-qr" },
      { filename: "ticket.png", content: qr, contentDisposition: "attachment" },
    ],
  });
}
