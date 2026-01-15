FROM oven/bun:1 AS builder

WORKDIR /app

# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build the app (VITE_API_URL will be embedded in the build)
RUN bun run build

# Production stage
FROM oven/bun:1

WORKDIR /app

# Install serve to run the app
RUN bun install -g serve

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Run application
CMD ["bunx", "serve", "-s", "dist", "-l", "3000"]
