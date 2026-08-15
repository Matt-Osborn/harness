FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ packages/
RUN npm ci && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/harness-server/package.json ./packages/harness-server/
COPY --from=build /app/packages/harness-shared/package.json ./packages/harness-shared/
COPY --from=build /app/packages/core-ai/package.json ./packages/core-ai/
COPY --from=build /app/packages/core-agent/package.json ./packages/core-agent/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/harness-server/dist ./packages/harness-server/dist
COPY --from=build /app/packages/harness-shared/dist ./packages/harness-shared/dist
COPY --from=build /app/packages/core-ai/dist ./packages/core-ai/dist
COPY --from=build /app/packages/core-agent/dist ./packages/core-agent/dist

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/v1/chat/completions || exit 1

ENTRYPOINT ["node", "packages/harness-server/dist/docker-entry.js"]