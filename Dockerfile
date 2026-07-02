FROM --platform=$BUILDPLATFORM node:22-alpine AS web-build
ARG VERSION=dev
ARG NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
COPY package*.json ./

RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi

RUN npm ci
COPY . .
RUN VERSION=$VERSION npm run build

FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS service-build
ARG TARGETOS
ARG TARGETARCH
ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=off
ARG GITHUB_PROXY_PREFIX=https://ghfast.top/https://github.com
WORKDIR /src

RUN if [ -n "$ALPINE_MIRROR" ]; then \
      version="$(cut -d. -f1,2 /etc/alpine-release)" && \
      echo "${ALPINE_MIRROR}/v${version}/main" > /etc/apk/repositories && \
      echo "${ALPINE_MIRROR}/v${version}/community" >> /etc/apk/repositories; \
    fi && \
    go env -w GOPROXY="$GOPROXY" && \
    go env -w GOSUMDB="$GOSUMDB"

RUN apk add --no-cache git && \
    if [ -n "$GITHUB_PROXY_PREFIX" ]; then git config --global url."${GITHUB_PROXY_PREFIX}".insteadOf "https://github.com"; fi

COPY usage-service ./usage-service
COPY --from=web-build /app/dist/index.html ./usage-service/internal/httpapi/web/management.html
WORKDIR /src/usage-service
RUN go mod download -x
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/cpa-manager ./cmd/cpa-manager

FROM alpine:3.21

ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine

RUN if [ -n "$ALPINE_MIRROR" ]; then \
      version="$(cut -d. -f1,2 /etc/alpine-release)" && \
      echo "${ALPINE_MIRROR}/v${version}/main" > /etc/apk/repositories && \
      echo "${ALPINE_MIRROR}/v${version}/community" >> /etc/apk/repositories; \
    fi && \
    apk add --no-cache ca-certificates wget

WORKDIR /app
COPY --from=service-build /out/cpa-manager /usr/local/bin/cpa-manager
ENV HTTP_ADDR=0.0.0.0:18317
ENV USAGE_DATA_DIR=/data
ENV USAGE_DB_PATH=/data/usage.sqlite
EXPOSE 18317
ENTRYPOINT ["cpa-manager"]
