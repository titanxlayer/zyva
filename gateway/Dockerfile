# ZYVA Embedding Gateway — runs on a normal CPU VPS (no GPU required).
FROM node:22-bookworm-slim
WORKDIR /app
COPY server.mjs ./
ENV PORT=8090
EXPOSE 8090
CMD ["node", "server.mjs"]
