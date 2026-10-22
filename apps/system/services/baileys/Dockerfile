FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir /data && chown node:node /data
COPY --chown=node:node *.mjs ./
USER node
ENV HOST=0.0.0.0 PORT=3010 BAILEYS_DATABASE=/data/baileys.sqlite
EXPOSE 3010
VOLUME ["/data"]
CMD ["node", "server.mjs"]
