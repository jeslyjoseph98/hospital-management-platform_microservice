# ---- deps & build stage ----
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

# Prune dev dependencies after compiling TS -> JS.
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY package*.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8083

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
