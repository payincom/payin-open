# Repository Guidelines

## Project Structure & Module Organization
The workspace is managed through npm workspaces. `apps/api`, `apps/admin`, `apps/website`, `apps/address-tool`, and `apps/mcp-server` are the deployable surfaces for multi-tenant payment and onboarding flows. Shared domain logic and adapters live in `packages/`, e.g. `packages/processor` for ledger orchestration, `packages/monitor` for chain watchers, `packages/manager` for configuration flows, and `packages/shared` for DTOs and utilities. Reusable testing helpers live in `packages/test-utils`. Documentation and architecture notes reside in `docs/` (Chinese content by convention). Database utilities, seeds, and migration scripts are under `tools/database/`.

## Build, Test & Development Commands
Run `npm install` once per environment. Use `npm run build` to compile every package. During feature work, `npm run build -w packages/processor` (swap scope as needed) targets a single module. Quick feedback comes from `npm run test:watch`; use `npm run test` for CI parity. `npm run lint:check` and `npm run format:check` verify style without mutation. Database workflows use `npm run db:migrate:up` / `down` and `npm run db:seed`. Integration suites run through `npm run test:integration` or `npm run test:integration:dry-run` for smoke validation.

## Coding Style & Naming Conventions
TypeScript is the default; keep files `.ts` unless JSX is required. Follow the enforced ESLint + Prettier rules (2-space indentation, single quotes, semicolons). Use PascalCase for classes and exported types, camelCase for functions and variables, and SCREAMING_SNAKE_CASE for constants. Code comments and JSDoc stay in English, while markdown in `docs/` remains in Chinese. Align folder names with their domain (`monitor`, `notification`, etc.), and prefer barrel exports from `packages/shared`.

## Testing Guidelines
Vitest powers unit coverage. Place unit tests next to implementation (`packages/*/tests` or `apps/api/tests`). Scenario and integration cases belong in `packages/processor/tests/scenarios` or `apps/api/tests/*e2e*`. Name files with `.test.ts` and describe behavior, e.g. `deposit-flow.test.ts`. Maintain coverage above the existing baseline by running `npm run test:coverage` before submitting.

## Commit & Pull Request Guidelines
Follow Conventional Commits as shown in history (`feat(email): ...`, `fix(notification): ...`). Scope commits tightly and squash fixups locally. Pull requests should include a concise summary, linked issue or task ID, test evidence (`npm run test` output or screenshots for UI), and call out migration or configuration changes.

## Documentation & Knowledge Sync
Use `CLAUDE.md` as the canonical system overview; mirror architectural or cross-module changes there as soon as they land. Update module-specific files in `docs/` (for example `docs/reference/processor-configuration.en.md`, `docs/reference/rpc-configuration.en.md`, and `docs/dev/architecture/`) alongside code so multi-tenant assumptions, migration plans, and business scenarios stay current. When adding new flows, record test strategies and sample credentials in the appropriate doc before requesting review.
