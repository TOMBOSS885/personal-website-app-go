# Full-stack image for the Go backend version.
# It builds l2d-widget, the React/Vite frontend, and the Go API, then runs
# Nginx plus the Go API in one small runtime container.

FROM node:20-alpine AS frontend-builder

WORKDIR /app/l2d-widget
COPY l2d-widget/package*.json ./
RUN npm install --legacy-peer-deps
COPY l2d-widget/ ./
RUN npm run build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS backend-builder

WORKDIR /app/go_back
COPY go_back/go.mod go_back/go.sum ./
RUN go mod download
COPY go_back/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/personal-website-api ./cmd/server

FROM alpine:3.20

LABEL maintainer="Claw"
LABEL description="Personal Website - Go Backend + Frontend"
LABEL version="2.0"

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
  CMD wget -qO- http://127.0.0.1:8080/api/public/profile >/dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
