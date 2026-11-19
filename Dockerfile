# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
USER node
EXPOSE 3000
CMD ["node", "build"]
