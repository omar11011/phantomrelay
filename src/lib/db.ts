import { kv } from '@vercel/kv';

export interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  messageEncrypted: string;
  previewUrl: string | null;
  sentAtDate: string;
  autoDeleteAt: string;
  createdAt: string;
}

export interface ResendConfigRecord {
  id: string;
  name: string;
  apiKey: string;
  senderEmail: string;
  senderName: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const EMAILS_KEY = 'phantomrelay:emails';
const CONFIGS_KEY = 'phantomrelay:resend_configs';

const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const localStore: Record<string, unknown> = {};

async function kvGet<T>(key: string): Promise<T | null> {
  if (hasKV) {
    return await kv.get<T>(key);
  }
  return (localStore[key] as T) || null;
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (hasKV) {
    await kv.set(key, value);
    return;
  }
  localStore[key] = value;
}

export const emailOps = {
  async create(data: {
    to: string; subject: string; messageEncrypted: string;
    previewUrl: string | null; sentAtDate: string; autoDeleteAt: Date;
  }): Promise<EmailRecord> {
    const now = new Date();
    await emailOps.purgeExpired();
    const record: EmailRecord = {
      id: generateId(), to: data.to, subject: data.subject,
      messageEncrypted: data.messageEncrypted, previewUrl: data.previewUrl,
      sentAtDate: data.sentAtDate, autoDeleteAt: data.autoDeleteAt.toISOString(),
      createdAt: now.toISOString(),
    };
    const emails: EmailRecord[] = await kvGet(EMAILS_KEY) || [];
    emails.push(record);
    await kvSet(EMAILS_KEY, emails);
    return record;
  },

  async purgeExpired(): Promise<void> {
    const emails: EmailRecord[] = await kvGet(EMAILS_KEY) || [];
    const now = new Date();
    const active = emails.filter(e => new Date(e.autoDeleteAt) > now);
    if (active.length !== emails.length) {
      await kvSet(EMAILS_KEY, active);
    }
  },

  async findMany(options: {
    orderBy: { createdAt: 'desc' }; take: number; select: (keyof EmailRecord)[];
  }): Promise<Array<Partial<EmailRecord>>> {
    await emailOps.purgeExpired();
    const emails: EmailRecord[] = await kvGet(EMAILS_KEY) || [];
    return emails
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, options.take)
      .map(email => {
        const result: Partial<EmailRecord> = {};
        for (const key of options.select) result[key] = email[key];
        return result;
      });
  },

  async deleteMany(where: { autoDeleteAt: { lte: Date } }): Promise<void> {
    const emails: EmailRecord[] = await kvGet(EMAILS_KEY) || [];
    const remaining = emails.filter(e => new Date(e.autoDeleteAt) > where.autoDeleteAt.lte);
    await kvSet(EMAILS_KEY, remaining);
  },
};

export const resendConfigOps = {
  async findMany(): Promise<ResendConfigRecord[]> {
    return await kvGet(CONFIGS_KEY) || [];
  },

  async findUnique(where: { id?: string }): Promise<ResendConfigRecord | null> {
    if (!where.id) return null;
    const configs: ResendConfigRecord[] = await kvGet(CONFIGS_KEY) || [];
    return configs.find(c => c.id === where.id) || null;
  },

  async findDefault(): Promise<ResendConfigRecord | null> {
    const configs: ResendConfigRecord[] = await kvGet(CONFIGS_KEY) || [];
    return configs.find(c => c.isDefault) || null;
  },

  async create(data: { name: string; apiKey: string; senderEmail: string; senderName: string; isDefault: boolean }): Promise<ResendConfigRecord> {
    const configs: ResendConfigRecord[] = await kvGet(CONFIGS_KEY) || [];
    const now = new Date().toISOString();
    if (data.isDefault) for (const c of configs) c.isDefault = false;
    const record: ResendConfigRecord = { id: generateId(), ...data, createdAt: now, updatedAt: now };
    configs.push(record);
    await kvSet(CONFIGS_KEY, configs);
    return record;
  },

  async update(where: { id: string }, data: { name?: string; apiKey?: string; senderEmail?: string; senderName?: string; isDefault?: boolean }): Promise<ResendConfigRecord> {
    const configs: ResendConfigRecord[] = await kvGet(CONFIGS_KEY) || [];
    const idx = configs.findIndex(c => c.id === where.id);
    if (idx === -1) throw new Error('Config not found');
    if (data.isDefault) for (const c of configs) c.isDefault = false;
    configs[idx] = { ...configs[idx], ...data, updatedAt: new Date().toISOString() };
    await kvSet(CONFIGS_KEY, configs);
    return configs[idx];
  },

  async delete(where: { id: string }): Promise<void> {
    let configs: ResendConfigRecord[] = await kvGet(CONFIGS_KEY) || [];
    const before = configs.length;
    configs = configs.filter(c => c.id !== where.id);
    if (configs.length !== before) {
      if (configs.length > 0 && !configs.some(c => c.isDefault)) {
        configs[0].isDefault = true;
      }
      await kvSet(CONFIGS_KEY, configs);
    }
  },
};

export const db = {
  anonymousEmail: emailOps,
  resendConfig: resendConfigOps,
};
