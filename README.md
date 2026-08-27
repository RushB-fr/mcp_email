# Mail MCP

[![License: PolyForm Shield 1.0.0](https://img.shields.io/badge/license-PolyForm%20Shield%201.0.0-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)

An [MCP](https://modelcontextprotocol.io) server that lets an LLM (Claude, or any MCP-compatible client) read, search, and send email from a real IMAP/SMTP mailbox — with its own web UI for account and mailbox management. Self-hostable today; a hosted version may also become available.

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [MCP tools](#mcp-tools)
- [Architecture, in short](#architecture-in-short)
- [Quick start (Docker, self-hosted)](#quick-start-docker-self-hosted)
- [Configuration reference](#configuration-reference)
- [Creating the first account](#creating-the-first-account)
- [Connecting an MCP client](#connecting-an-mcp-client)
- [Backups](#backups)
- [Development](#development)
- [License](#license)

## Why this exists

Most "connect your email to an AI" tools require OAuth with Gmail/Outlook specifically. This works against any IMAP/SMTP provider instead, and can be self-hosted on your own domain if you'd rather not depend on anyone else's instance at all.

## Features

- **Bring your own mailbox** — any IMAP/SMTP provider, not locked to Gmail/Outlook. Credentials are tested live before being saved and encrypted at rest (AES-256-GCM).
- **Identity decoupled from mailboxes** — sign up once (email/password, or Google/GitHub), attach as many mailboxes as you want afterwards. No mailbox required to have an account.
- **Organizations** — share mailboxes across accounts with real access control (owner vs. member, per-mailbox or per-group grants), including granting access to an invite before it's even accepted.
- **Two MCP auth modes** — a static per-account bearer token for simple clients, or full OAuth 2.1 with Dynamic Client Registration + PKCE for clients like a Claude custom connector.
- **Bilingual UI** — French/English, switchable per session via a cookie.
- **Invite-gated signup** — closed by default, no open public registration; you control who gets an account.
- **Self-healing login** — if you rotate a mailbox's password at your provider, the next login re-validates and re-encrypts it automatically instead of locking you out.

## MCP tools

| Tool | Description |
| --- | --- |
| `list_mailboxes` | Every mailbox the current connector can act on (own + shared via an organization) |
| `list_folders` | Folders in a mailbox (INBOX, Sent, ...) |
| `search_emails` | By sender, subject, body substring, unread-only, date range |
| `get_email` | Full content of one message by UID |
| `send_email` | Send from the configured mailbox |
| `mark_as_read` | Mark a message read or unread |

All tools accept an optional `mailbox` argument to target a specific accessible mailbox; omitted, they use the account's default.

## Architecture, in short

- **`User`** — an identity: email + password (bcrypt) or Google/GitHub sign-in. Owns zero or more mailboxes and holds the account-level MCP bearer token.
- **`Mailbox`** — one IMAP/SMTP connection, owned by a `User`, tested live on attach. Two different accounts can each attach the same real-world address if they each hold working credentials for it.
- **`Organization`** — a group of `User`s sharing mailboxes. An `OWNER` gets full access to everything shared in the org automatically; a `MEMBER` only gets what's explicitly granted — one mailbox at a time, or dynamically via a named `MailboxGroup` (mailboxes added to the group later are covered immediately, no new grant needed). Access can be pre-configured for an invited email before they've even created an account, and migrates automatically once they accept.
- **MCP auth** — a bearer token (static, one per account, from Réglages > Applications) or an OAuth 2.1 access token (Dynamic Client Registration + PKCE, revocable independently of the JWT's own expiry) both resolve to the same thing: the account's full accessible mailbox set.

Stack: Next.js 16 (App Router, Server Actions), Prisma + PostgreSQL, Auth.js v5, Tailwind CSS, Radix UI, `imapflow`/`nodemailer`/`mailparser` for the actual mail protocols.

## Quick start (Docker, self-hosted)

```bash
git clone https://github.com/RushB-fr/mcp_email.git
cd mcp_email
cp .env.example .env
```

Fill in `.env` — at minimum:

- `POSTGRES_PASSWORD` (pick one)
- `AUTH_SECRET` and `MCP_MASTER_KEY` (each: `openssl rand -base64 32`)
- `APP_BASE_URL` (the public URL this instance will be reachable at)

Everything else in `.env.example` is documented inline with a sane default or is optional. See the [configuration reference](#configuration-reference) below.

For a local/dev instance (publishes a port, no reverse proxy):

```bash
docker compose up -d --build
```

Or behind an existing Traefik instance (no ports published, routed by domain — set `DOMAIN` and `TRAEFIK_NETWORK` in `.env` first):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Either way, migrations run automatically on container start.

## Configuration reference

Full details and inline comments live in [`.env.example`](.env.example) — this is a summary.

| Variable | Required | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Yes | Postgres credentials, shared by `DATABASE_URL` |
| `AUTH_SECRET` | Yes | Signs sessions and (by default) OAuth access tokens |
| `MCP_MASTER_KEY` | Yes | Encrypts mailbox passwords at rest — deliberately separate from `AUTH_SECRET` |
| `APP_BASE_URL` | Recommended | Public URL; required for links in transactional emails (never falls back to a client-supplied header for those) |
| `AUTH_TRUST_HOST` | Behind a reverse proxy | Lets Auth.js trust `X-Forwarded-*` headers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Adds "Sign in with Google" as a second login method for an existing account |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional | Same, for GitHub |
| `SMTP_FROM_*` | Optional | The platform's own outgoing address for signup verification and org-invite emails — unrelated to any user's mailbox |
| `DOMAIN` / `TRAEFIK_NETWORK` | `docker-compose.prod.yml` only | Domain Traefik routes to this app, and the external network your Traefik is attached to |
| `APP_PORT` | `docker-compose.yml` (local) only | Host port to expose |

## Creating the first account

Signup is invite-gated. Generate an invite from inside the running container:

```bash
docker compose exec app npx tsx scripts/create-invite.ts
```

This prints a one-time signup link, valid for 7 days. Redeeming it creates a `User` (email + password, or sign in with Google/GitHub afterwards if configured) — no mailbox yet. Once logged in, attach a mailbox from Réglages: its IMAP/SMTP credentials are tested live before being saved, which is the only proof of ownership required.

## Connecting an MCP client

From Réglages > Applications, either:

- copy the static bearer token and the MCP server URL (`<APP_BASE_URL>/api/mcp`) into any MCP client that supports a plain bearer token, or
- point a client that supports OAuth 2.1 + Dynamic Client Registration (like a Claude custom connector) at the same URL and go through the authorization screen.

Both resolve to the same account and the same set of accessible mailboxes.

## Backups

```bash
./scripts/backup.sh
```

Dumps the Postgres database to `backups/` (gitignored — it contains real user data). Run it before any schema migration; see `prisma/migrations/` for how this project handles migrations that need a data backfill (additive migration → data script → follow-up migration, never a single destructive step against live data).

## Development

```bash
npm install
npm run dev        # requires a reachable Postgres - see docker-compose.yml
npm run typecheck
npm run lint
```

## License

[PolyForm Shield 1.0.0](LICENSE) — free to use, modify, self-host, and use commercially, for any purpose **except** providing a product or service that competes with this project or with anything the licensor uses it to provide (including a hosted/SaaS version of this same project, should one launch). This is **source-available, not OSI-approved open source** (OSI's definition requires allowing any use, including competing commercial use). Ask if you need different terms.
