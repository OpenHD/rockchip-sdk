# NEX Music server — Socket.io + yt-dlp DSP stream proxy
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js stream.js ./

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "index.js"]
