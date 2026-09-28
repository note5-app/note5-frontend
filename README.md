# NOTE5 — frontend

**The web app behind [NOTE5](https://note5-app.github.io/note5-frontend/).**

Encrypted, offline-first notes with optional sync to a private GitHub
repository. No accounts, no build step, no framework.

---

## What this repo is

This is the entire frontend: HTML, CSS, vanilla JavaScript. No bundler, no
transpiler, no `node_modules`. Clone it, serve it statically, done.

Cloud sync is opt-in and uses a **Cloudflare Worker** as a relay to a private
GitHub repository. The Worker source is not in this repo — it holds the
credential that writes to the repository and is intentionally kept closed.

- **App (live):** https://note5-app.github.io/note5-frontend/
- **Org:** https://github.com/note5-app
- **Backend repository (private):** `note5-app/note5-backups`

---

## Features

- Three note types: **chat**, **file**, **credentials**
- Full-text search with scoped prefixes (`name:`, `current:`, `global:`)
- Pin, custom icon per note, dark / light theme
- Local autosave with configurable interval, unsaved-changes warning
- Optional manual and automatic cloud backup (12h / daily / weekly / monthly)
- Versioned backups with conflict detection
- Manual export / import of encrypted backups (`.note5`)
- Progressive Web App (installable, offline-capable)
- Built-in debug panel (`?debug=1`) with an interactive JS console

---

## Stack

- **Vanilla ES2022.** No framework, no build step, no bundler.
- **IndexedDB** for notes, **localStorage** for settings and session metadata,
  **sessionStorage** for the master key bits (survives page reloads within the
  same tab, cleared on tab close).
- **Web Crypto API** for all crypto, executed in a dedicated **Web Worker**.
- **Service Worker** for PWA shell caching.
- **Cloudflare Worker** as the relay to GitHub.
- **GitHub Pages** for hosting.

---

## Architecture

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  Browser (SPA)   │       │ Cloudflare       │       │  note5-backups   │
│                  │──PUT─▶│ Worker (relay)   │──PUT─▶│  (private repo)  │
│  • Web Crypto    │       │                  │       │                  │
│  • IndexedDB     │◀─GET──│  • Rate limiting │◀─GET──│  /backups/{uid}/ │
│  • Service Worker│       │  • Size limits   │       │    current.json  │
│                  │       │  • Per-user quota│       │    v.../chunk_*  │
└──────────────────┘       └──────────────────┘       └──────────────────┘
     ciphertext only            opaque relay            ciphertext only
```

- The Worker holds the GitHub PAT. The browser never sees it.
- The Worker enforces rate limits (10 req/min per IP), per-chunk size limits
  (512 KB), and per-user storage quotas (50 MB).
- The repo stores one folder per user: `backups/{userId}/current.json` plus
  versioned chunk files under `v{timestamp}/`.
- Everything the repo contains is AES-256-GCM ciphertext.

---

## Cryptography

### Key derivation

```
masterBits = PBKDF2-SHA256(username + ":" + password, "note5-master-v1", 100 000 iters, 256 bits)
userId     = SHA-256(masterBits || "note5-userid-v1")            → 64 hex chars
subkey     = HKDF-SHA256(masterBits, salt_random_16B, "note5-aead-v1")  → per-envelope key
```

The `userId` is deterministic: the same username and password always produce
the same identifier. This is what allows the app to work without a server-side
user registry.

### Encryption envelope

```
[version:1B][salt:16B][nonce:12B][ciphertext:N][tag:16B]
```

- **AES-256-GCM** with a per-envelope subkey. Random nonce, unique subkey, no
  nonce reuse.
- **AAD** is the version byte, preventing downgrade attacks.
- The GCM tag authenticates the entire ciphertext. One tampered byte anywhere
  in the envelope causes decryption to fail.

Backups above ~500 KB are split into chunks **after encryption**. Chunking is
a transport concern for GitHub's 1 MB per-file API limit, not a cryptographic
boundary. The GCM tag authenticates the whole backup regardless of chunking.

### Password guidance

Recommend **at least 12 characters** or **4–5 random words**, consistent with
NIST SP 800-63B and OWASP guidance.

---

## Running locally

```bash
git clone https://github.com/note5-app/note5-frontend.git
cd note5-frontend
python3 -m http.server 8004
```

Open `http://localhost:8004/?debug=1`.

> **Web Crypto requires HTTPS or localhost.** Opening via `file://` will fail.

The app works fully locally without any cloud setup. Cloud sync requires
pointing `js/config.js` at a Worker of your own, which in turn needs a private
GitHub backup repository.

---

## Deployment

### Frontend

Push to `main` and enable **GitHub Pages** for the repo. No build step.

Before deploying, update `js/config.js`:

```js
export const CONFIG = {
  WORKER_URL: 'https://<your-worker>.<your-subdomain>.workers.dev',
  // ...
};
```

### Worker

```bash
cd worker
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN
```

`wrangler.toml` needs:

- `ALLOWED_ORIGIN` — comma-separated list of allowed origins, e.g.
  `"https://note5-app.github.io,http://localhost:8004"`
- `GITHUB_OWNER=note5-app`, `GITHUB_REPO=note5-backups`
- `USAGE_KV` bound to a KV namespace for per-user quota tracking
- `RATE_LIMITER` bound to a Cloudflare rate-limit namespace

The `GITHUB_TOKEN` secret must be a fine-grained PAT with
`Contents: Read and write` on the backup repo only.

---

## Debug panel

Append `?debug=1` to the URL. A panel appears at the bottom with:

- Live console output, warnings and errors (colour-coded)
- Every `fetch` call (URL, method, status, duration)
- Worker errors with full stack traces
- An interactive JS console with history

Disable with `?debug=0` or the **disable** button in the panel.

---

## Browser support

Firefox 90+ · Chrome 90+ · Safari 15+ · Edge 90+.

Requires `crypto.subtle`, IndexedDB and Service Workers.

---

## Status

Alpha. Features may change. Backups are your responsibility. Keep an encrypted
export (`.note5`) somewhere you control.

---

## License

All rights reserved. Personal project.
