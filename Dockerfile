FROM node:20-slim AS builder

WORKDIR /app

# Install client dependencies and build
COPY client/package*.json client/
RUN cd client && npm ci

COPY client/ client/
RUN cd client && npm run build

# Install server dependencies and build
COPY server/package*.json server/
COPY server/tsconfig.json server/
RUN cd server && npm ci

COPY server/src/ server/src/
RUN cd server && npx tsc

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy compiled server and production deps
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy built client
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
