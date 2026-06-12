import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeInput, sanitizeEmail } from '@/lib/utils';
import { encryptMessage, sendAnonymousEmail, EmailConfig } from '@/lib/email';

// Rate limiting
const apiRateLimit = new Map<string, { count: number; resetAt: number }>();
const API_RATE_LIMIT = 10; // 10 emails per window
const API_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkApiRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = apiRateLimit.get(ip);

  if (!entry || now > entry.resetAt) {
    apiRateLimit.set(ip, { count: 1, resetAt: now + API_RATE_WINDOW });
    return true;
  }

  if (entry.count >= API_RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// POST: Send anonymous email
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkApiRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Limite de envios alcanzado. Intenta de nuevo mas tarde.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Sanitize inputs
    const to = sanitizeEmail(body.to || '');
    const subject = sanitizeInput(body.subject || '');
    const message = sanitizeInput(body.message || '').slice(0, 5000);
    const configId = body.configId || null; // Optional: specific config to use
    const useRandomSender = body.useRandomSender === true; // Anti-blocking mode

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'El email del destinatario no es valido' },
        { status: 400 }
      );
    }

    // Encrypt message
    const messageEncrypted = encryptMessage(message);

    // Prepare metadata
    const now = new Date();
    const sentAtDate = now.toISOString().split('T')[0];
    const autoDeleteAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Resolve email config: check DB first, fall back to env vars
    let emailConfig: EmailConfig | undefined;
    try {
      let config = null;

      // If a specific config ID was provided, use it
      if (configId) {
        config = await db.resendConfig.findUnique({ id: configId });
      }

      // Otherwise, use the default config
      if (!config) {
        config = await db.resendConfig.findDefault();
      }

      if (config) {
        emailConfig = {
          apiKey: config.apiKey,
          senderEmail: config.senderEmail,
          senderName: config.senderName,
          useRandomSender: useRandomSender,
        };
      } else if (useRandomSender) {
        // No DB config but random sender requested — use env vars with random mode
        emailConfig = {
          apiKey: process.env.RESEND_API_KEY || '',
          senderEmail: process.env.SENDER_EMAIL || 'onboarding@resend.dev',
          senderName: process.env.SENDER_NAME || 'PhantomRelay',
          useRandomSender: true,
        };
      }
    } catch (err) {
      console.error('Error loading email config:', err instanceof Error ? err.message : 'unknown');
    }

    // Send the email (via Resend API with optional config)
    let sendMode = 'simulated';
    let previewUrl: string | null = null;
    let usedSender: string | null = null;
    try {
      const sendResult = await sendAnonymousEmail(to, subject, message, emailConfig);
      sendMode = sendResult.mode || 'simulated';
      previewUrl = sendResult.previewUrl || null;
      usedSender = sendResult.usedSender || null;
    } catch (sendErr) {
      console.error('Send error (non-fatal):', sendErr instanceof Error ? sendErr.message : 'unknown');
    }

    // Store encrypted data
    await db.anonymousEmail.create({
      to,
      subject,
      messageEncrypted,
      previewUrl,
      sentAtDate,
      autoDeleteAt,
    });

    return NextResponse.json({
      success: true,
      mode: sendMode,
      previewUrl,
      usedSender,
      autoDeleteIn: '24 horas',
    }, { status: 200 });
  } catch (error) {
    console.error('Server error (no user data logged):', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET: Email history
export async function GET() {
  try {
    // Get emails from memory
    const emails = await db.anonymousEmail.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: ['id', 'to', 'subject', 'sentAtDate', 'previewUrl', 'autoDeleteAt'],
    });

    // Mask email addresses
    const maskedEmails = (emails as any[]).map((email) => {
      const [user, domain] = email.to.split('@');
      const masked =
        user && user.length > 2
          ? user[0] + '*'.repeat(Math.min(user.length - 2, 5)) + user[user.length - 1]
          : '***';
      return {
        ...email,
        to: `${masked}@${domain || '***'}`,
        messageAvailable: false,
      };
    });

    return NextResponse.json({ emails: maskedEmails }, { status: 200 });
  } catch (error) {
    console.error('Server error (no user data logged):', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
