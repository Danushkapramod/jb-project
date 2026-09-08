# Production Dockerfile for Render deployment
FROM node:20-slim

# Prevent debconf from attempting interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install Chromium, fonts, and native compilation tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Instruct Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Ensure directory for WhatsApp session auth exists
RUN mkdir -p .wwebjs_auth

ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]
