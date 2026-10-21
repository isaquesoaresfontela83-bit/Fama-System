FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:hybrid-api
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production FAMA_RUNTIME=hybrid FAMA_DEPLOY_TARGET=hybrid HOSTNAME=0.0.0.0 PORT=10000 NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 10000
CMD ["sh","-c","node server/hybrid-check.mjs && exec node server.js"]
