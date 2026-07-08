<div align="center">

<img width="90" height="90" alt="m41nitor-logo" src="https://github.com/user-attachments/assets/ddc29ff7-43e5-44aa-aa10-60fe33d72157" />

# M41NITOR
**A terminal-inspired file manager with unlimited storage — powered by Telegram.**

Drag, drop, and forget about storage limits. Files route straight into your own private Telegram channels; PostgreSQL just remembers where everything went.

[![Encrypted](https://img.shields.io/badge/AES--256--GCM-Encryption-F72585?style=for-the-badge&logoColor=212529)](#)
[![Self Hosted](https://img.shields.io/badge/Self--Hosted-Storage-343A40?style=for-the-badge)](#)
[![Type](https://img.shields.io/badge/Type-File%20Manager-212529?style=for-the-badge)](#)

</div>

---

## About

M41NITOR is a **private, terminal-inspired file manager** that uses Telegram as its storage backend.

Telegram holds the actual file content in your own private chats; PostgreSQL keeps the searchable metadata. The result is a black-and-pink terminal UI over what is effectively unlimited, free cloud storage — under your own control.

> *"Your files. Your channels. Your terminal."*

---

## Upload Flow

```
Drag & Drop / Paste
    ↓
Backend Inspection   →  MIME check, dangerous extension block, sanitize filename
    ↓
Integrity & Security →  SHA-256 checksum, duplicate check, optional AES-256-GCM
    ↓
Telegram Routing     →  Sent to the matching private channel by category
    ↓
Metadata Saved       →  PostgreSQL stores searchable record
    ↓
Terminal View        →  Grid / table, search, favourites, signed downloads
```

---

## Features

- **Admin Authentication** — bcrypt password hashing with HTTP-only, signed session cookies
- **Flexible Uploads** — Drag-and-drop, multi-file, folder-capable, and clipboard-image uploads with real browser progress
- **Hardened Pipeline** — Backend MIME inspection, dangerous extension blocking, filename sanitization, SHA-256 checksums, duplicate prevention, optional AES-256-GCM encryption, and category-based Telegram routing
- **Full File Management** — Grid/table views, search, sorting, favourites, previews, signed downloads, soft delete, restore, permanent delete, metadata updates
- **Audit & Recovery** — Audit logs, recovery records, health checks, and settings endpoints
- **Zero Secret Exposure** — No bot token, chat ID, database URL, password, session token, or encryption key ever reaches browser code

---

## Built For

```
Purpose  → Personal, private, self-hosted file storage
Backend  → Telegram private channels (content) + PostgreSQL (metadata)
Theme    → Black & pink terminal
Not For  → Public file sharing or CDN-style hosting
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js, TypeScript |
| Database | PostgreSQL (Neon), Prisma |
| Storage Backend | Telegram Bot API |
| Security | bcrypt, AES-256-GCM, signed session cookies |
| Styling | CSS |
| Deployment | Docker, Vercel |

---

## Project Structure

```
m41nitor/
├── deploy/
├── prisma/
├── public/
├── scripts/
├── src/
├── Dockerfile
├── docker-compose.yml
└── vercel.json
```

---

## Setup Guide

1. Create a Telegram bot via BotFather and copy the token into `TELEGRAM_BOT_TOKEN`
2. Create private Telegram channels or groups for images, videos, audio, documents, archives, and other files
3. Add the bot as an administrator to every private channel or group
4. Grant posting and deletion permissions
5. Obtain each chat ID safely — never paste real chat IDs into source code
6. Copy `.env.example` to `.env` and configure every required environment variable
7. Create the PostgreSQL database (e.g. [Neon](https://neon.tech)) and set `DATABASE_URL`
8. Run `npm run prisma:generate` and `npm run prisma:migrate`
9. Generate the admin password hash with `npm run hash-password` and set `ADMIN_PASSWORD_HASH`
10. Start the dev server with `npm run dev`
11. Test all Telegram destination mappings on the Destinations page
12. Upload a small test file
13. Test preview, download, soft delete, restore, and permanent deletion
14. Configure database backups and protect the encryption key outside the database

---

## Development

```
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Runs at `http://localhost:3000`.

## Production

```
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build
npm run start
```

Use HTTPS in production. Set a strong `SESSION_SECRET`, secure your PostgreSQL access, and store `FILE_ENCRYPTION_KEY` in a secret manager.

## Docker

```
docker compose up --build
docker compose run --rm app npm run prisma:deploy
```

---

## Telegram Bot API

Defaults to the Telegram cloud Bot API. To use a self-hosted Local Bot API server:

```
TELEGRAM_API_BASE_URL=https://telegram-bot-api.example.com
```

Files are not silently split — chunking exists in the schema but must be explicitly enabled per your deployment limits.

---

## Backups

Back up PostgreSQL regularly. Telegram holds the content, but the database holds the only searchable metadata and message references. M41NITOR should not be treated as your only backup.

---

## Roadmap / Ideas

- [ ] Explicit chunked-upload support for very large files
- [ ] Shared/read-only access links
- [ ] Multi-admin roles and permissions
- [ ] Mobile-optimised terminal view
- [ ] Storage usage dashboard per category

---

<div align="center">

*M41NITOR — your files, your channels, your terminal.*

</div>
