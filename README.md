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

PhantomRelay is a privacy-focused anonymous email relay built with Next.js. It routes messages through an encrypted node that stores no IP addresses, encrypts all content with AES-256-CBC, and automatically purges every record after 24 hours. No external database is required — everything runs on a lightweight JSON file store, making deployment as simple as a single command.

The application is designed for scenarios where communication privacy matters: whistleblowing, anonymous tip lines, secure contact forms, or any use case where the sender's identity must remain completely detached from the message.

---

## Key Features

| Feature | Description |
|---|---|
| **AES-256-CBC Encryption** | Messages are encrypted with a scrypt-derived key before being written to storage. The database never holds plaintext. |
| **24h Auto-Purge (TTL)** | All records are automatically deleted 24 hours after creation. No manual cleanup, no lingering data. |
| **Zero IP Logging** | IP addresses are never stored. Rate limiting is handled through an ephemeral in-memory map that resets on restart. |
| **Random Sender Mode** | Each email is sent from a unique, randomly generated address (e.g. `m5x2k-a7f3@domain.com`) to prevent sender blocking and correlation. |
| **Multi-Provider Delivery** | Automatic fallback chain: Resend API → SMTP → Simulated mode. Works even without an email provider for testing. |
| **Multiple API Configs** | Manage several Resend API keys and sender identities from the UI. Switch between configs or set a default. |
| **Rate Limiting** | 10 emails per hour per IP. Protects against abuse without storing any identifying information. |
| **Security Headers** | CSP, HSTS, X-Frame-Options DENY, XSS Protection, Referrer-Policy, and Permissions-Policy are applied to every response. |
| **Standalone Deploy** | Production build outputs a self-contained server. No Node modules needed at runtime — just the standalone directory, static assets, and an `.env` file. |
| **No External Database** | Uses a JSON file store with an in-memory cache. Zero setup, zero migrations, zero dependencies. |

---

## Tech Stack

- **Framework** — [Next.js 16](https://nextjs.org/) (App Router, standalone output)
- **Language** — [TypeScript 5](https://www.typescriptlang.org/)
- **Styling** — [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Icons** — [Lucide React](https://lucide.dev/)
- **Email Delivery** — [Resend API](https://resend.com/) / SMTP (nodemailer) / Simulated
- **Encryption** — Node.js `crypto` (AES-256-CBC, scrypt key derivation)
- **Reverse Proxy** — [Caddy](https://caddyserver.com/) (Caddyfile included)

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- A [Resend](https://resend.com/) API key (free tier available)

### 1. Clone & Install

```bash
git clone https://github.com/omar11011/phantomrelay.git
cd PhantomRelay
npm install       # or: bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your own values:

```env
RESEND_API_KEY=re_your_api_key_here
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=PhantomRelay
ENCRYPTION_KEY=generate-a-random-32+-char-string-here
```

> **Important:** Change `ENCRYPTION_KEY` to a unique, random string. This key is used to derive the AES-256 encryption key for all stored messages.

### 3. Run

**Development:**
```bash
npm run dev
```

**Production (recommended):**
```bash
npm run build
npm run start
```

**Using the startup script (builds if needed):**
```bash
bash scripts/dev.sh
```

The server starts on `http://localhost:3000`.

---

## Deployment

### Standalone Build

PhantomRelay uses Next.js standalone output mode, which produces a self-contained server bundle:

```bash
npm run build
```

The standalone server is at `.next/standalone/server.js`. To deploy:

```bash
# Copy required assets
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env .next/standalone/.env

# Run
cd .next/standalone
NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 node server.js
```

### With Caddy (Reverse Proxy)

A `Caddyfile` is included for production deployments behind Caddy:

```bash
# Build and start everything
bash scripts/start.sh
```

This starts the Next.js server on port 3000 and Caddy on port 81, which reverse-proxies to the app with proper headers.

### Docker / Cloud

The standalone output is ideal for containerized deployments. Copy the `.next/standalone` directory, static assets, public folder, and your `.env` into your container image. No `node_modules` required at runtime.

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Your Resend API key (starts with `re_`). Get one at [resend.com](https://resend.com/). |
| `SENDER_EMAIL` | Yes | Default sender email address. Must be a verified domain in Resend. |
| `SENDER_NAME` | No | Display name for the sender. Defaults to `PhantomRelay`. |
| `ENCRYPTION_KEY` | Yes | Secret key for AES-256 encryption. Generate a unique random string. |
| `SMTP_HOST` | No | SMTP server hostname (fallback delivery). |
| `SMTP_PORT` | No | SMTP port (`587` for STARTTLS, `465` for SSL). |
| `SMTP_USER` | No | SMTP authentication username. |
| `SMTP_PASS` | No | SMTP authentication password. |
| `SMTP_FROM` | No | SMTP sender address. |

### Multi-Config via UI

You can manage multiple Resend API configurations directly from the Settings panel in the app. Each config stores its own API key, sender email, and sender name. One config can be marked as the default.

---

## API Reference

### `POST /api`

Send an anonymous email.

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "message": "This is an anonymous message."
}
```

**Response (200):**
```json
{
  "success": true,
  "mode": "api",
  "usedSender": "m5x2k-a7f3@yourdomain.com",
  "autoDeleteIn": "24 horas"
}
```

**Rate Limit:** 10 requests/hour per IP. Returns `429` when exceeded.

### `GET /api`

Retrieve email history (last 50, non-expired only). Recipient addresses are masked (`j***n@domain.com`). Message content is never returned.

### `GET /api/settings`

List all Resend API configurations. API keys are masked for security.

### `POST /api/settings`

Manage Resend configurations.

**Actions:** `create`, `update`, `delete`, `set_default`

**Example (create):**
```json
{
  "action": "create",
  "name": "Production",
  "apiKey": "re_xxxxxxxx",
  "senderEmail": "noreply@yourdomain.com",
  "senderName": "PhantomRelay",
  "isDefault": true
}
```

---

## Security

PhantomRelay is built with a security-first approach across multiple layers:

### Transport & Headers
- **Content-Security-Policy** restricts script, style, and connection sources
- **Strict-Transport-Security** enforces HTTPS with 1-year max-age
- **X-Frame-Options: DENY** prevents clickjacking
- **X-Content-Type-Options: nosniff** prevents MIME sniffing
- **Referrer-Policy: no-referrer** leaks no referrer data
- **Permissions-Policy** disables camera, microphone, geolocation, and payment APIs

### Data Protection
- All messages are encrypted with **AES-256-CBC** using a scrypt-derived key before storage
- **No IP addresses** are ever stored — rate limiting uses an ephemeral in-memory map
- **Approximate timestamps** — only the date is stored, never the exact time
- **24-hour TTL** — all records are automatically and irreversibly purged
- **Input sanitization** — all user inputs are stripped of HTML, JavaScript, and event handlers

### Email Privacy
- **Random sender mode** generates a unique sending address per email
- **Anti-tracking headers** (List-Unsubscribe) are included in outbound emails
- **Masked history** — recipient addresses are partially hidden in the UI

---

## Project Structure

```
PhantomRelay/
├── public/                  # Static assets (favicons, robots.txt)
├── scripts/                 # Build & deployment scripts
│   ├── dev.sh               # Development/production launcher
│   ├── build.sh             # Full CI/CD build
│   └── start.sh             # Production orchestrator (Next.js + Caddy)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── route.ts     # Email send & history endpoints
│   │   │   └── settings/
│   │   │       └── route.ts # Resend config management
│   │   ├── globals.css      # Tailwind base styles
│   │   ├── layout.tsx       # Root layout with metadata & security headers
│   │   └── page.tsx         # Main application (single-page)
│   ├── components/ui/       # shadcn/ui components
│   ├── hooks/               # React hooks (use-mobile, use-toast)
│   └── lib/
│       ├── db.ts            # JSON file store with in-memory cache
│       ├── email.ts         # Encryption, email delivery, random sender
│       └── utils.ts         # Tailwind merge, input sanitization
├── .env.example             # Environment variable template
├── Caddyfile                # Reverse proxy configuration
├── next.config.ts           # Next.js config (standalone output, security headers)
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with Next.js · Tailwind CSS · Resend</sub>
</p>
