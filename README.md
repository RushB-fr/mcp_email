# Mail MCP

A self-hosted [MCP](https://modelcontextprotocol.io) server that lets an LLM (Claude, or any MCP-compatible client) read, search, and send email from a real IMAP/SMTP mailbox — with its own web UI for account and mailbox management.

Tools exposed to the connected model:

- `list_mailboxes` — every mailbox the current connector can act on
- `list_folders` — folders in a mailbox (INBOX, Sent, ...)
- `search_emails` — by sender, subject, body, unread-only, date range
- `get_email` — full content of one message
- `send_email` — send from the configured mailbox
- `mark_as_read` — mark a message read/unread

## Why this exists

Most "connect your email to an AI" tools either require OAuth with Gmail/Outlook specifically, or ask you to hand over your mailbox password to a third-party SaaS. This is meant to be the opposite: something you run yourself, on your own domain, against any IMAP/SMTP provider — the app never has to be trusted by anyone but you.

## Architecture, in short

- **Identity is decoupled from mailboxes.** A `User` is just an account (email + password, or Google/GitHub sign-in) — it owns zero or more `Mailbox` rows (IMAP/SMTP credentials, tested live before being saved). Logging in doesn't require having a mailbox attached yet, and one account can hold several mailboxes.
- **Organizations let mailboxes be shared** between accounts with real access control: an `OWNER` has full access to everything shared in the org; a `MEMBER` only sees what's explicitly granted, mailbox by mailbox or via a named group of mailboxes. Access can be granted to an invite before it's even accepted.
- **Two ways for an MCP client to authenticate**: a static per-account bearer token (simplest, paste the URL + token into any MCP client), or a full OAuth 2.1 flow with Dynamic Client Registration and PKCE (what a "Claude" custom connector uses). Either way, the connector resolves the account's full accessible set of mailboxes — its own plus anything shared with it.
- **Bilingual UI** (French/English), a simple cookie-based switch, no accounts or content translated beyond the app chrome itself.
- Platform signup is **invite-gated** — there's no open public registration. See [Creating the first account](#creating-the-first-account) below.

Stack: Next.js 16 (App Router), Prisma + PostgreSQL, Auth.js v5, Tailwind, Radix UI.

## Quick start (self-hosted, Docker)

```bash
git clone https://github.com/rushb-fr/mcp_email.git
cd mcp_email
cp .env.example .env
```

Fill in `.env` — at minimum:

- `POSTGRES_PASSWORD` (pick one)
- `AUTH_SECRET` and `MCP_MASTER_KEY` (each: `openssl rand -base64 32`)
- `APP_BASE_URL` (the public URL this instance will be reachable at)

Everything else in `.env.example` is documented inline and either has a sane default or is optional (Google/GitHub sign-in, transactional email for signup verification and org invites).

Then, for a local/dev instance (publishes a port, no reverse proxy):

```bash
docker compose up -d --build
```

Or, behind an existing Traefik instance (no ports published, routed by domain — set `DOMAIN` and `TRAEFIK_NETWORK` in `.env` first):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Creating the first account

Signup is invite-gated. Generate an invite from inside the running container:

```bash
docker compose exec app npx tsx scripts/create-invite.ts
```

This prints a one-time signup link, valid for 7 days. Redeeming it creates a `User` (just email + password, or you can sign in with Google/GitHub afterwards if configured) — no mailbox yet. Once logged in, attach a mailbox from Réglages: its IMAP/SMTP credentials are tested live before being saved, and that's the only proof of ownership required.

## Connecting an MCP client

From Réglages > Applications, either:

- copy the static bearer token and the MCP server URL (`<APP_BASE_URL>/api/mcp`) into any MCP client that supports a plain bearer token, or
- point a client that supports OAuth 2.1 + Dynamic Client Registration (like a Claude custom connector) at the same URL and go through the authorization screen.

Both resolve to the same account and the same set of accessible mailboxes.

## Backups

```bash
./scripts/backup.sh
```

Dumps the Postgres database to `backups/` (gitignored — it contains real user data). Run it before any schema migration; see `prisma/migrations/` for how this project handles migrations that need a data backfill (additive migration → script → follow-up migration, never a single destructive step against live data).

## Development

```bash
npm install
npm run dev        # requires a reachable Postgres - see docker-compose.yml
npm run typecheck
npm run lint
```

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free to use, modify, and self-host for any noncommercial purpose. This is **source-available, not OSI-approved open source**: commercial use or redistribution isn't covered by this license. Ask if you need different terms.
