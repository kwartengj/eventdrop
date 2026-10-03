# AWS CodeBuild runs `docker build -f ./Dockerfile .` from the repository root.
# The Next.js app lives in host/.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY host/package.json host/package-lock.json ./
RUN npm install

COPY host/ .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
