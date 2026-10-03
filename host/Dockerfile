FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_BOOTSTRAP=1
RUN npm run build
ENV SKIP_BOOTSTRAP=0

EXPOSE 3000
CMD ["npm", "start"]
