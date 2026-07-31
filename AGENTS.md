# Repository Guidelines

## Project Structure & Module Organization

Figure is a Next.js 16 application in strict TypeScript. App Router pages and API handlers live in `src/app/`; reusable UI belongs in `src/components/`; domain logic, provider clients, and storage adapters live in `src/lib/`. Shared types go in `src/types/`. Prisma schema, migrations, and seed data are under `prisma/`, while static assets belong in `public/`. Tests are colocated as `*.test.ts` (for example, `src/lib/storage/storage.test.ts`). Generated images in `.media/`, databases, `.next/`, and coverage output are ignored.

## Build, Test, and Development Commands

- `npm install` installs the locked dependencies. Node.js 20.9 or newer is required.
- `npm run dev` starts the local Next.js development server.
- `npm run db:generate && npm run db:push && npm run db:seed` prepares and seeds the local SQLite database.
- `npm test` runs the Vitest suite once.
- `npm run typecheck` checks strict TypeScript without emitting files.
- `npm run lint` runs ESLint with zero warnings allowed.
- `npm run build` produces the production build; `npm run check` runs the complete verification gate.

## Coding Style & Naming Conventions

Follow the existing ESLint configuration and TypeScript strictness. Use two-space indentation, semicolons, double quotes, and trailing commas in multiline constructs. Prefer `@/` imports for code under `src/`, and separate external imports from internal ones. Name React components and types in PascalCase, functions and variables in camelCase, and source files/routes in kebab-case. Keep server credentials and provider access out of client components.

## Testing Guidelines

Vitest uses a Node environment. Add focused tests beside logic-heavy modules, naming files `subject.test.ts`. Use behavior-oriented `describe`/`it` text and cover success, validation, and failure paths. No numeric coverage threshold is configured; regressions should nevertheless include a test. Run `npm run check` before requesting review.

## Commit & Pull Request Guidelines

History uses concise, imperative subjects, with recent commits also using Conventional Commit prefixes such as `feat:` and `fix:`. Prefer that format and keep each commit focused. Pull requests should explain the user-visible effect, identify configuration or schema changes, link the relevant issue, and list verification performed. Include screenshots for UI changes and commit Prisma migrations alongside schema changes.

## Security & Configuration

Copy `.env.example` to `.env.local`; never commit credentials, generated media, or local databases. Use the documented demo account only for local development. When adding environment variables, provide safe placeholders in `.env.example` and access secrets from server-only code.
