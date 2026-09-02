# Single-stage build (MVP: keeps drizzle-kit available for migrate-on-start).
# For production scale, split into multi-stage with only prod deps + a
# separate one-off migration job.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# DATABASE_URL comes from the environment (compose / Railway)
RUN npm run build

EXPOSE 3000
CMD ["sh", "-c", "npx drizzle-kit migrate && node .next/standalone/server.js"]
