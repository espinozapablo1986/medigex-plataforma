# ── Dependencias ──────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ─────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DATABASE_URL sólo debe existir para que `prisma generate` no falle;
# la conexión real se toma en tiempo de ejecución.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-secret-value"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ── Herramientas (migraciones y semilla) ──────────────────────
# Reutiliza las capas del build, así que no cuesta tiempo extra.
FROM builder AS tools
WORKDIR /app
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# ── Runtime ───────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl curl tzdata
ENV TZ=America/Santiago
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# El commit queda dentro de la imagen: permite comprobar desde fuera qué
# versión está sirviendo realmente el contenedor, en vez de suponerlo.
ARG VERSION=dev
ENV APP_VERSION=$VERSION

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Salida standalone de Next.js: incluye sólo las dependencias que la
# aplicación realmente usa en tiempo de ejecución, cliente Prisma incluido.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Carpeta de adjuntos (se monta como volumen en producción)
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
