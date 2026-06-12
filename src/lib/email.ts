import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY no configurada');
  return scryptSync(ENCRYPTION_KEY, 'phantom-relay-salt', 32);
}

export function encryptMessage(message: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptMessage(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = parts[1];
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateRandomSender(domain: string): { email: string; name: string } {
  const ts = Date.now().toString(36);
  const suffix = randomBytes(2).toString('hex');
  return {
    email: `${ts}-${suffix}@${domain}`,
    name: 'PhantomRelay',
  };
}

export interface SendResult {
  success: boolean;
  previewUrl?: string;
  error?: string;
  messageId?: string;
  mode?: 'smtp' | 'api' | 'simulated';
  usedSender?: string;
}

export interface EmailConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  useRandomSender?: boolean;
}

export async function sendAnonymousEmail(
  to: string,
  subject: string,
  message: string,
  config?: EmailConfig
): Promise<SendResult> {
  const resendApiKey = config?.apiKey || process.env.RESEND_API_KEY || '';

  if (resendApiKey && resendApiKey.startsWith('re_')) {
    try {
      let senderEmail = config?.senderEmail || process.env.SENDER_EMAIL || 'onboarding@resend.dev';
      let senderName = config?.senderName || process.env.SENDER_NAME || 'PhantomRelay';

      if (config?.useRandomSender && senderEmail.includes('@')) {
        const domain = senderEmail.split('@')[1];
        const random = generateRandomSender(domain);
        senderEmail = random.email;
        senderName = random.name;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${senderEmail}>`,
          to: [to],
          subject,
          text: message,
          html: buildEmailHtml(subject, message),
          headers: getPrivacyHeaders(senderEmail),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, messageId: data.id, mode: 'api', usedSender: senderEmail };
      }

      console.error('Resend API error:', JSON.stringify(data));
      return { success: false, mode: 'simulated', error: `Resend error: ${data.message || 'Unknown'}` };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      console.error('Resend API error:', msg);
      return { success: false, mode: 'simulated', error: `API fallo: ${msg}` };
    }
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
      const transporter = nodemailer.default.createTransport({
        host: smtpHost, port: smtpPort, secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const senderEmail = process.env.SMTP_FROM || smtpUser;
      const result = await transporter.sendMail({
        from: `"PhantomRelay" <${senderEmail}>`, to, subject, text: message,
        html: buildEmailHtml(subject, message), headers: getPrivacyHeaders(senderEmail),
      });
      return { success: true, messageId: result.messageId, mode: 'smtp' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      console.error('SMTP error:', msg);
      return { success: false, mode: 'simulated', error: `SMTP fallo: ${msg}` };
    }
  }

  return {
    success: true,
    mode: 'simulated',
    messageId: `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function getPrivacyHeaders(senderEmail: string): Record<string, string> {
  return { 'List-Unsubscribe': `mailto:${senderEmail}` };
}

function buildEmailHtml(subject: string, message: string): string {
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#064e3b,#0f766e);padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:600;">PhantomRelay</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#111827;margin:0 0 16px;font-size:18px;">${subject}</h2>
          <div style="color:#374151;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapedMessage}</div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Enviado via PhantomRelay</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
