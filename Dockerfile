FROM node:20-slim AS builder

WORKDIR /app

# Install client dependencies and build
COPY client/package*.json client/
RUN cd client && npm ci

COPY client/ client/
RUN cd client && npm run build

# Install server dependencies
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev

COPY server/ server/

FROM node:20-slim

WORKDIR /app

# Copy server with production deps
COPY --from=builder /app/server ./server

# Copy built client
COPY --from=builder /app/client/dist ./client/dist

# Install tsx for running TypeScript directly
RUN cd server && npm install tsx

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

EXPOSE 3001

CMD ["npx", "-y", "tsx", "server/src/index.ts"]
