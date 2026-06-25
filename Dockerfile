# SynapseCRO — Fly.io / container deploy (Next.js standalone)
FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Fly build-secrets (fly.toml) are mounted at /run/secrets/<id> during deploy.
RUN --mount=type=secret,id=SUPABASE_URL \
    --mount=type=secret,id=SUPABASE_PUBLISHABLE_KEY \
    SUPABASE_URL="$(cat /run/secrets/SUPABASE_URL)" \
    SUPABASE_PUBLISHABLE_KEY="$(cat /run/secrets/SUPABASE_PUBLISHABLE_KEY)" \
    npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
