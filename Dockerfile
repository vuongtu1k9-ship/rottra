FROM oven/bun:latest

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy dependency configs first for caching
COPY package.json bun.lock ./
RUN bun install

# Copy source code
COPY . .

# Expose port 8080 (default exposed port)
EXPOSE 8080

# Environment variable default
ENV PORT=8080

# Run Hono + WebSockets in a single process under Bun
CMD ["bun", "run", "src/server/prod.ts"]
