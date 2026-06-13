<p align="center">
  <img src="public/android-chrome-192x192.png" alt="PhantomRelay" width="96" height="96" />
  <h1 align="center">PhantomRelay</h1>
  <p align="center">Secure relay node. End-to-end encrypted message routing.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-emerald" alt="version" />
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="typescript" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="license" />
</p>

---

## Overview

PhantomRelay is a privacy-focused anonymous email relay built with Next.js. It routes messages through an encrypted node that stores no IP addresses, encrypts all content with AES-256-CBC, and automatically purges every record after 24 hours. Powered by Vercel KV for persistent serverless storage — no external database setup required.

Designed for scenarios where communication privacy matters: whistleblowing, anonymous tip lines, secure contact forms, or any use case where the sender's identity must remain completely detached from the message.

---

## Key Features

| Feature | Description |
|---|---|
| **AES-256-CBC Encryption** | Messages encrypted with scrypt-derived key before storage. The database never holds plaintext. |
| **24h Auto-Purge (TTL)** | All records automatically deleted 24 hours after creation. No manual cleanup. |
| **Zero IP Logging** | IP addresses are never stored. Rate limiting uses an ephemeral in-memory map. |
| **Random Sender Mode** | Each email sent from a unique random address (e.g. `m5x2k-a7f3@domain.com`) to prevent blocking. |
| **Multi-Provider Delivery** | Automatic fallback: Resend API → SMTP → Simulated mode. |
| **Multiple API Configs** | Manage several Resend API keys and sender identities from the UI. |
| **Rate Limiting** | 10 emails per hour per IP. Protects against abuse. |
| **Security Headers** | CSP, HSTS, X-Frame-Options DENY, XSS Protection on every response. |
| **Serverless Database** | Vercel KV (Redis) — persistent storage without managing any database server. |
| **One-Click Deploy** | Deploy to Vercel with zero configuration. |

---

## Tech Stack

- **Framework** — [Next.js 16](https://nextjs.org/) (App Router)
- **Language** — [TypeScript 5](https://www.typescriptlang.org/)
- **Styling** — [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Icons** — [Lucide React](https://lucide.dev/)
- **Database** — [Vercel KV](https://vercel.com/storage/kv) (serverless Redis)
- **Email Delivery** — [Resend API](https://resend.com/) / SMTP / Simulated
- **Encryption** — Node.js `crypto` (AES-256-CBC, scrypt key derivation)
- **Hosting** — [Vercel](https://vercel.com/)

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/omar11011/PhantomRelay.git
cd PhantomRelay
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
RESEND_API_KEY=re_your_api_key_here
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=PhantomRelay
ENCRYPTION_KEY=generate-a-random-32+-char-string-here
```

### 3. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Deploy to Vercel

The easiest way to deploy PhantomRelay:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/omar11011/PhantomRelay)

### Manual Steps

1. Go to [vercel.com](https://vercel.com) → sign up with GitHub
2. Click **"Add New Project"** → select your PhantomRelay repo
3. Add **Environment Variables**:
   - `RESEND_API_KEY`
   - `SENDER_EMAIL`
   - `SENDER_NAME`
   - `ENCRYPTION_KEY`
4. Click **Deploy**
5. In the Vercel dashboard, go to **Storage** → **Create Database** → **KV (Redis)**
6. Link the KV store to your project — Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`

That's it. Your app is live at `your-project.vercel.app`.

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key (starts with `re_`). Get one at [resend.com](https://resend.com/). |
| `SENDER_EMAIL` | Yes | Default sender email. Must be a verified domain in Resend. |
| `SENDER_NAME` | No | Display name for the sender. Defaults to `PhantomRelay`. |
| `ENCRYPTION_KEY` | Yes | Secret key for AES-256 encryption. Generate a unique random string. |
| `SMTP_HOST` | No | SMTP server hostname (fallback delivery). |
| `SMTP_PORT` | No | SMTP port (`587` for STARTTLS, `465` for SSL). |
| `SMTP_USER` | No | SMTP authentication username. |
| `SMTP_PASS` | No | SMTP authentication password. |
| `SMTP_FROM` | No | SMTP sender address. |

> **Vercel KV** variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) are auto-configured when you create a KV store in the Vercel dashboard.

---

## API Reference

### `POST /api`

Send an anonymous email.

```json
// Request
{ "to": "recipient@example.com", "subject": "Hello", "message": "Anonymous message." }

// Response (200)
{ "success": true, "mode": "api", "usedSender": "m5x2k-a7f3@domain.com", "autoDeleteIn": "24 horas" }
```

Rate limit: 10 requests/hour per IP. Returns `429` when exceeded.

### `GET /api`

Email history (last 50, non-expired). Recipient addresses are masked. Message content never returned.

### `GET /api/settings`

List all Resend API configurations. API keys are masked.

### `POST /api/settings`

Manage Resend configs. Actions: `create`, `update`, `delete`, `set_default`.

---

## Security

- **Content-Security-Policy** restricts script, style, and connection sources
- **Strict-Transport-Security** enforces HTTPS (1-year max-age)
- **X-Frame-Options: DENY** prevents clickjacking
- **X-Content-Type-Options: nosniff** prevents MIME sniffing
- **Referrer-Policy: no-referrer** leaks no referrer data
- **Permissions-Policy** disables camera, mic, geolocation, payment APIs
- **AES-256-CBC encryption** with scrypt-derived key before storage
- **No IP addresses stored** — ephemeral in-memory rate limiting
- **24-hour TTL** — all records auto-purged
- **Input sanitization** — HTML, JavaScript, and event handlers stripped
- **Random sender mode** — unique sending address per email
- **Anti-tracking headers** in outbound emails

---

## Project Structure

```
PhantomRelay/
├── public/                  # Favicons, robots.txt
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── route.ts     # Email send & history
│   │   │   └── settings/
│   │   │       └── route.ts # Resend config management
│   │   ├── globals.css
│   │   ├── layout.tsx       # Root layout + security headers
│   │   └── page.tsx         # Main application
│   ├── components/ui/       # shadcn/ui components
│   ├── hooks/               # React hooks
│   └── lib/
│       ├── db.ts            # Vercel KV database layer
│       ├── email.ts         # Encryption + email delivery
│       └── utils.ts         # Tailwind merge + sanitization
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## License

MIT

---

<p align="center">
  <sub>Built with Next.js · Tailwind CSS · Vercel KV · Resend</sub>
</p>
