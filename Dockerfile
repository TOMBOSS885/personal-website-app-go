# syntax=docker/dockerfile:1.7
# Full-stack image for the Go backend version.
# It builds l2d-widget, the React/Vite frontend, and the Go API, then runs
# Nginx plus the Go API in one small runtime container.

FROM node:24-alpine AS frontend-builder

ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry "$NPM_REGISTRY" \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000

WORKDIR /app/l2d-widget
COPY l2d-widget/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --no-audit --no-fund
COPY l2d-widget/ ./
RUN npm run build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./
RUN npm run build
RUN find /app/frontend/dist -type f \( \
      -name '*.html' -o \
      -name '*.js' -o \
      -name '*.css' -o \
      -name '*.json' -o \
      -name '*.svg' -o \
      -name '*.txt' \
    \) -exec sh -c 'gzip -9 -c "$1" > "$1.gz"' sh {} \;

FROM golang:1.26.5-alpine AS backend-builder

ARG GOPROXY=https://goproxy.cn,direct
ENV GOPROXY=$GOPROXY

WORKDIR /app/go_back
COPY go_back/go.mod go_back/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY go_back/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/personal-website-api ./cmd/server

FROM alpine:3.22

LABEL maintainer="Claw"
LABEL description="Personal Website - Go Backend + Frontend"
LABEL version="1.2.1"

RUN apk add --no-cache nginx supervisor wget tzdata \
    && addgroup -S app \
    && adduser -S app -G app \
    && mkdir -p /app/uploads /run/nginx /var/log/supervisor /var/www/html

WORKDIR /app

COPY --from=backend-builder /out/personal-website-api /app/personal-website-api
COPY --from=frontend-builder /app/frontend/dist /var/www/html
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf

RUN chmod +x /entrypoint.sh \
    && chown -R app:app /app/uploads /var/log/supervisor

EXPOSE 3718 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3718/api/health >/dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
