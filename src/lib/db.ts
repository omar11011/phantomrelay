import path from 'path';
import fs from 'fs';

interface EmailRecord {
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

interface DataStore {
  emails: EmailRecord[];
  resendConfigs: ResendConfigRecord[];
}

let _cache: DataStore | null = null;
const _dataDir = path.join(process.cwd(), 'data');
const _dataFile = path.join(_dataDir, 'store.json');

function readStore(): DataStore {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(_dataFile)) {
      const raw = fs.readFileSync(_dataFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.resendConfigs) parsed.resendConfigs = [];
      _cache = parsed;
      return _cache;
    }
  } catch {
    // Archivo corrupto, iniciar vacio
  }
  const empty: DataStore = { emails: [], resendConfigs: [] };
  _cache = empty;
  return empty;
}

function writeStore(data: DataStore): void {
  _cache = data;
  try {
    if (!fs.existsSync(_dataDir)) {
      fs.mkdirSync(_dataDir, { recursive: true });
    }
    fs.writeFileSync(_dataFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write data store:', err);
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const emailOps = {
  async create(data: {
    to: string; subject: string; messageEncrypted: string;
    previewUrl: string | null; sentAtDate: string; autoDeleteAt: Date;
  }): Promise<EmailRecord> {
    const store = readStore();
    const now = new Date();
    store.emails = store.emails.filter(e => new Date(e.autoDeleteAt) > now);
    const record: EmailRecord = {
      id: generateId(), to: data.to, subject: data.subject,
      messageEncrypted: data.messageEncrypted, previewUrl: data.previewUrl,
      sentAtDate: data.sentAtDate, autoDeleteAt: data.autoDeleteAt.toISOString(),
      createdAt: now.toISOString(),
    };
    store.emails.push(record);
    writeStore(store);
    return record;
  },

  async findMany(options: {
    orderBy: { createdAt: 'desc' }; take: number; select: (keyof EmailRecord)[];
  }): Promise<Array<Partial<EmailRecord>>> {
    const store = readStore();
    const now = new Date();
    return store.emails
      .filter(e => new Date(e.autoDeleteAt) > now)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, options.take)
      .map(email => {
        const result: Partial<EmailRecord> = {};
        for (const key of options.select) result[key] = email[key];
        return result;
      });
  },

  async deleteMany(where: { autoDeleteAt: { lte: Date } }): Promise<void> {
    const store = readStore();
    const before = store.emails.length;
    store.emails = store.emails.filter(e => new Date(e.autoDeleteAt) > where.autoDeleteAt.lte);
    if (store.emails.length !== before) writeStore(store);
  },
};

export const resendConfigOps = {
  async findMany(): Promise<ResendConfigRecord[]> {
    return readStore().resendConfigs || [];
  },

  async findUnique(where: { id?: string }): Promise<ResendConfigRecord | null> {
    if (where.id) return (readStore().resendConfigs || []).find(c => c.id === where.id) || null;
    return null;
  },

  async findDefault(): Promise<ResendConfigRecord | null> {
    return (readStore().resendConfigs || []).find(c => c.isDefault) || null;
  },

  async create(data: { name: string; apiKey: string; senderEmail: string; senderName: string; isDefault: boolean }): Promise<ResendConfigRecord> {
    const store = readStore();
    const now = new Date().toISOString();
    if (data.isDefault) for (const c of store.resendConfigs) c.isDefault = false;
    const record: ResendConfigRecord = { id: generateId(), ...data, createdAt: now, updatedAt: now };
    store.resendConfigs.push(record);
    writeStore(store);
    return record;
  },

  async update(where: { id: string }, data: { name?: string; apiKey?: string; senderEmail?: string; senderName?: string; isDefault?: boolean }): Promise<ResendConfigRecord> {
    const store = readStore();
    const idx = (store.resendConfigs || []).findIndex(c => c.id === where.id);
    if (idx === -1) throw new Error('Resend config not found');
    if (data.isDefault) for (const c of store.resendConfigs) c.isDefault = false;
    store.resendConfigs[idx] = { ...store.resendConfigs[idx], ...data, updatedAt: new Date().toISOString() };
    writeStore(store);
    return store.resendConfigs[idx];
  },

  async delete(where: { id: string }): Promise<void> {
    const store = readStore();
    const before = store.resendConfigs.length;
    store.resendConfigs = store.resendConfigs.filter(c => c.id !== where.id);
    if (store.resendConfigs.length !== before) {
      if (store.resendConfigs.length > 0 && !store.resendConfigs.some(c => c.isDefault)) {
        store.resendConfigs[0].isDefault = true;
      }
      writeStore(store);
    }
  },
};

export const db = {
  anonymousEmail: emailOps,
  resendConfig: resendConfigOps,
};
