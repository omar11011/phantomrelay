import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'anonmail-secret-key-2024';
const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  return scryptSync(ENCRYPTION_KEY, 'anonmail-salt', 32);
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
  const email = `${ts}-${suffix}@${domain}`;
  const name = 'PhantomRelay';
  return { email, name };
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
  const resendApiKey = config?.apiKey || process.env.RESEND_API_KEY || process.env.SMTP_PASS;

  if (resendApiKey && resendApiKey.startsWith('re_')) {
    try {
      let senderEmail = config?.senderEmail || process.env.SENDER_EMAIL || process.env.SMTP_FROM || 'onboarding@resend.dev';
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
          subject: subject,
          text: message,
          html: buildEmailHtml(subject, message),
          headers: getPrivacyHeaders(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          messageId: data.id,
          mode: 'api',
          usedSender: senderEmail,
        };
      } else {
        console.error('Resend API error:', JSON.stringify(data));
        return {
          success: false,
          mode: 'simulated',
          error: `Resend error: ${data.message || 'Unknown error'}`,
        };
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      console.error('Resend API error:', msg);
      return {
        success: false,
        mode: 'simulated',
        error: `API fallo: ${msg}`,
      };
    }
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass && !smtpPass.startsWith('re_')) {
    try {
      const nodemailer = await import(/* webpackIgnore: true */ 'nodemailer').catch(() => null);
      if (!nodemailer) {
        return {
          success: false,
          mode: 'simulated',
          error: 'nodemailer no instalado',
        };
      }
      const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const senderEmail = process.env.SMTP_FROM || smtpUser;

      const result = await transporter.sendMail({
        from: `"PhantomRelay" <${senderEmail}>`,
        to,
        subject: subject,
        text: message,
        html: buildEmailHtml(subject, message),
        headers: getPrivacyHeaders(),
      });

      return {
        success: true,
        messageId: result.messageId,
        mode: 'smtp',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      console.error('SMTP error:', msg);
      return {
        success: false,
        mode: 'simulated',
        error: `SMTP fallo: ${msg}`,
      };
    }
  }

  return {
    success: true,
    mode: 'simulated',
    messageId: `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function getPrivacyHeaders(): Record<string, string> {
  return {
    'X-Mailer': 'PR-Node/3.2',
    'X-Priority': '3',
    'X-Anonymized': 'true',
    'X-No-Track': 'true',
    Precedence: 'bulk',
    'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN',
  };
}

function buildEmailHtml(subject: string, message: string): string {
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #064e3b, #0f766e); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: #ecfdf5; margin: 0; font-size: 22px;">Mensaje</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <h2 style="color: #111827; margin: 0 0 16px; font-size: 18px;">${subject}</h2>
        <div style="color: #374151; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${escapedMessage}</div>
      </div>
    </div>
  `;
}
