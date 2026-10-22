FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ENV FAMA_DEPLOY_TARGET=vps NEXT_PUBLIC_FAMA_RUNTIME=vps NEXT_TELEMETRY_DISABLED=1
RUN npm run build:vps

FROM node:24-bookworm-slim AS application
WORKDIR /app
ENV NODE_ENV=production FAMA_DEPLOY_TARGET=vps FAMA_RUNTIME=vps HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN mkdir /data && chown node:node /data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["sh", "-c", "node server/vps-init.mjs && exec node server.js"]
