# AWS CodeBuild runs `docker build -f ./Dockerfile .` from the repository root.
# This image is only the Next.js process. It exits unless DATABASE_URL reaches
# Postgres and S3_* reaches MinIO. Elastic Beanstalk serves the site from
# docker-compose.yml, which starts those services and publishes host port 80.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY host/package.json host/package-lock.json ./
RUN npm install

COPY host/ .

ENV NEXT_TELEMETRY_DISABLED=1
RUN NODE_OPTIONS=--max-old-space-size=1536 npm run build

EXPOSE 3000
CMD ["npm", "start"]
