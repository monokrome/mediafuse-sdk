FROM node:22-alpine AS build
WORKDIR /build
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /app
RUN corepack enable pnpm
COPY --from=build /build/package.json /build/pnpm-lock.yaml /build/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /build/dist ./dist

RUN mkdir -p /opt/mediafuse
VOLUME /opt/mediafuse

EXPOSE 8000
ENTRYPOINT ["node", "dist/cli/index.js", "--data", "/opt/mediafuse"]
