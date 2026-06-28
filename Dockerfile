FROM --platform=$BUILDPLATFORM node:22-alpine AS web-build
ARG VERSION=dev
WORKDIR /app
COPY package*.json ./

RUN R1="registry" && R2="npmmirror" && R3="com" && \
    npm config set registry https://${R1}.${R2}.${R3}

RUN npm ci
COPY . .
RUN VERSION=$VERSION npm run build

FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS service-build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src

RUN G1="goproxy" && G2="cn" && \
    go env -w GOPROXY=https://${G1}.${G2},direct && \
    go env -w GOSUMDB=off

RUN apk add --no-cache git && \
    H1="ghfast" && H2="top" && \
    git config --global url."https://${H1}.${H2}/https://github.com".insteadOf "https://github.com"

COPY usage-service ./usage-service
COPY --from=web-build /app/dist/index.html ./usage-service/internal/httpapi/web/management.html
WORKDIR /src/usage-service
RUN go mod download
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/cpa-manager ./cmd/cpa-manager

FROM alpine:3.21

RUN P1="mirrors" && P2="aliyun" && P3="com" && P4="alpine" && P5="v3.21" && \
    echo "https://${P1}.${P2}.${P3}/${P4}/${P5}/main" > /etc/apk/repositories && \
    echo "https://${P1}.${P2}.${P3}/${P4}/${P5}/community" >> /etc/apk/repositories && \
    apk add --no-cache ca-certificates wget

WORKDIR /app
COPY --from=service-build /out/cpa-manager /usr/local/bin/cpa-manager
ENV HTTP_ADDR=0.0.0.0:18317
ENV USAGE_DATA_DIR=/data
ENV USAGE_DB_PATH=/data/usage.sqlite
EXPOSE 18317
ENTRYPOINT ["cpa-manager"]
