# CLAUDE.md

This file provides guidance to Claude Code and other AI developer agents when working with code in this repository.

## Project Overview

Rottra is a Premium Agricultural E-commerce Platform and Intelligent Autonomous AI Agent System. It is built with a Hono backend, a SolidJS frontend, and PostgreSQL (via Drizzle ORM).

## Commands

### Development & Build
```bash
# Run dev environment (starts WebRTC signaling server on 8080 and Vite on 5173)
bun run dev

# Build the production application
bun run build

# Format source files using Prettier
bun run format
```

### Verification & Harness Check
```bash
# Validate project structure and codebase health
./init.sh

# Run local harness validation script
bun scripts/build-tools/validate-harness.ts
```

### Database Operations
```bash
# Push schema updates to PostgreSQL database
bun x drizzle-kit push

# Run master database seed
bun run src/db/master_seed.ts
```

## Repository Structure

- `src/` — Main application source code
  - `client/` — SolidJS frontend (views, components, stores, utils, context)
  - `core/` — AI engines (NLP, swarm, RAG, quant, neural-memory, chrono, meta-harness)
  - `infra/` — Infrastructure (database, network, telemetry)
  - `routes/` — Hono API catch-all route
  - `server/` — Server logic (auth, API routers, helpers, RPC, services)
  - `shared/` — Shared types, constants, DTOs
  - `workers/` — Web Worker background tasks
- `skills/` — Unified memory and skill guidelines for the AI Agent
- `scripts/` — Utility scripts (ai-pipeline, build-tools, data-cleaning, db-ops)
- `docs/` — Project documentation (architecture, resources, cognitive guides)
- `tests/` — Test suites (unit, e2e, benchmark, database)

## Coding Guidelines

- **Language:** TypeScript strict-mode. Always keep type definitions accurate.
- **Reactivity (SolidJS):** Use signals and stores for state. Do NOT destruct component `props` to maintain reactivity.
- **Styling:** TailwindCSS 4.0 (integrated via `@tailwindcss/vite` in `vite.config.ts`).
- **Database:** Query via Drizzle ORM. Handle optional property types carefully under `exactOptionalPropertyTypes: true` compiler configurations.
- **Operational Health:** Ensure `./init.sh` and `bun run build` compile with exit code 0 before completing any work.

## Agent Rules & Workflow

### Startup Workflow
- Before writing code, the agent must:
  1. Synchronize project symbols by running `bun run sync-ai`.
  2. Read the state artifacts: `feature_list.json` and `progress.md` to understand current work status.

### One-Feature-At-A-Time & Scope Boundary
- The agent must work on **one feature at a time** (one-feature-at-a-time rule).
- **Stay in scope:** Do not edit files outside the current feature scope.

### Definition of Done & Completion Gate
- A task is considered **done only when**:
  1. Code compiles successfully without type or lint errors.
  2. The automated verification script `./init.sh` runs successfully.
  3. Tests are verified (e.g. using `bun test` or verification commands).

### End of Session Procedure
- Before ending the session, the agent must:
  1. Update `progress.md` and `session-handoff.md` with the latest status.
  2. Run `bun run sync-ai` to synchronize the project.
