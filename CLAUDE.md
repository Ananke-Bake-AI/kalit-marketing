# Kalit Marketing — Autonomous Growth Operating System

## What is this
Multi-client autonomous growth platform. Each client gets a dedicated "Growth Workspace" — an isolated runtime that researches, creates, launches, reviews, and optimizes marketing actions continuously.

## Architecture
- **Monorepo** with pnpm workspaces
- `apps/web` — Next.js 15 (App Router, Turbopack, Tailwind v4)
- `packages/db` — Prisma + PostgreSQL (canonical growth schema)
- `packages/core` — Shared types, state machines, canonical models

## Key Concepts
- **Growth Workspace** — isolated per-client environment (config, assets, memory, pipeline, campaigns)
- **Client Lifecycle State Machine** — onboarding → auditing → strategy_ready → producing → launching → monitoring → optimizing → scaling
- **Task Pipeline** — 4 job families: research, production, execution, review
- **Policy Engine** — per-client autonomy rules (draft/approval/guardrailed/autonomous)
- **Canonical Growth Schema** — platform-agnostic campaign/creative/audience models
- **3 Trigger Modes** — request-driven, event-driven, scheduled

## Commands
```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Build for production
pnpm db:generate  # Generate Prisma client
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema to DB
pnpm db:studio    # Open Prisma Studio
```

## Infrastructure
```bash
docker compose up -d  # Start PostgreSQL + Redis
```

## Tech Stack
- Next.js 15, React 19, TypeScript 5.6
- Tailwind CSS v4
- Prisma 5 + PostgreSQL 16
- Redis 7
- Zod for validation
- pnpm 9 workspaces
