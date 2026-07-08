FROM oven/bun:1.3-alpine

WORKDIR /app

# Install dashboard deps first (layer cache — only invalidated when package.json changes)
COPY dashboard/package.json ./dashboard/
RUN cd dashboard && bun install --production

# Copy full project
COPY . .

EXPOSE 3000

CMD ["bun", "run", "dashboard/server.ts"]
