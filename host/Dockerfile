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
# t3.micro has 1 GB. Give the build a larger heap so it can use swap
# instead of being killed while EC2 still shows Running.
RUN NODE_OPTIONS=--max-old-space-size=1536 npm run build
ENV SKIP_BOOTSTRAP=0

EXPOSE 3000
CMD ["npm", "start"]
