# Personal website full-stack Docker image.
# Frontend, backend, and nginx are packaged in one container.

# Stage 1: build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/l2d-widget

COPY l2d-widget/package*.json ./
RUN npm install --legacy-peer-deps

COPY l2d-widget/ ./
RUN npm run build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: build backend
FROM maven:3.9-eclipse-temurin-21-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/pom.xml ./

RUN mvn dependency:go-offline -B

COPY backend/src ./src

RUN mvn clean package -DskipTests -B

# Stage 3: runtime image
FROM ubuntu:22.04

LABEL maintainer="Claw"
LABEL description="Personal Website - Full Stack (Frontend + Backend)"
LABEL version="1.0"

RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    openjdk-21-jre-headless \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /app/backend/target/*.jar app.jar

COPY --from=frontend-builder /app/frontend/dist /var/www/html

COPY docker/nginx.conf /etc/nginx/sites-enabled/default

COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /app/uploads

EXPOSE 3718 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/public/profile || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
