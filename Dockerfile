# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
# --legacy-peer-deps: next-auth's optional nodemailer peer range (^7 || ^8)
# hasn't caught up to nodemailer 9.x yet, which we need for its security
# fixes; next-auth's own (unused) email provider is the only thing affected.
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && apk add --no-cache wget openssl

# Full node_modules (needed at runtime for the Prisma CLI used by
# entrypoint.sh, which runs outside the traced Next.js standalone bundle).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

COPY scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

# Not part of the automatic startup flow - run manually to invite a new
# mailbox account: docker compose exec app npx tsx scripts/create-invite.ts
COPY --from=builder /app/scripts/create-invite.ts ./scripts/create-invite.ts

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./scripts/entrypoint.sh"]
