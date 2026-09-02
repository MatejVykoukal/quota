# Quota

A control plane for API usage — track, limit, and manage how your APIs are consumed.

## Overview

Quota is an MVP demo showcasing full-stack engineering: a control plane where API owners can define rate limits and quotas, issue API keys, and observe usage in real time.

## Features (planned)

- **API keys** — issue, revoke, and scope keys per project
- **Quotas & rate limits** — per-key limits (requests/min, daily/monthly caps)
- **Usage metering** — record and aggregate API call metrics
- **Control plane UI** — dashboard for configuring limits and viewing usage
- **Enforcement API** — lightweight gateway endpoint to check/record usage

## Tech Stack

_TBD — see the sections below as we build._

## Getting Started

### 1. Start Postgres

```bash
cp .env.example .env   # set POSTGRES_PASSWORD first
 docker compose up -d
```

### 2. Run the app

```bash
cd app
cp .env.example .env   # set DATABASE_URL (see below) and AUTH_SECRET
npm install
npm run db:migrate
npm run seed
npm run dev
```

`app/.env` variables:

```
DATABASE_URL="postgres://<user>:<password>@localhost:5433/<db>"
AUTH_SECRET="random-long-string"
```

### 3. Try the gateway

The seed script prints an API key once. Use it against the enforcement endpoint:

```bash
curl -X POST http://localhost:3000/api/gateway/hello \
  -H "Authorization: Bearer qk_live_…"
```

Over a limit → `429 rate_limit_exceeded`. No key → `401 unauthorized`.

## Roadmap

- [ ] Project scaffolding
- [ ] Data model & migrations
- [ ] API key management
- [ ] Usage metering & enforcement
- [ ] Dashboard UI
- [ ] Demo seed data
