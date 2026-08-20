# .claude — Project Configuration for Store-HideAuto

Configuration and agents for **Store-HideAuto** — a store that sells **automation scripts**
(`.hideflow` workflows) for the hideflow desktop app.

Stack: **TypeScript monorepo (pnpm)** — **NestJS + Prisma + PostgreSQL** (`server/`) and
**Next.js App Router + React 19** (`web/`).

---

## 📁 Structure

```
.claude/
├── agents/          # code review & analysis agents
├── commands/        # workflow commands
├── rules/           # project coding rules (typescript.md, store-guardrails.md)
├── identity.json    # project metadata
├── launch.json      # dev server config for the preview pane
├── package-manager.json  # pnpm
└── settings.local.json   # local settings
```

---

## 🚀 Commands

```bash
# New resource/endpoint (NestJS + Prisma, plus the Next.js page)
/feature-development

# PostgreSQL schema change / data migration (Prisma)
/database-migration
```

---

## 🔧 Rules & Conventions

- **`.claude/rules/typescript.md`** — TypeScript/NestJS/Next.js conventions, structure, security.
- **`.claude/rules/store-guardrails.md`** — guardrails, commit workflow, architecture layering, review checklist.

### Identity (`identity.json`)
- Project: Store-HideAuto
- Domains: typescript, nestjs, prisma, postgresql, nextjs, react, rest-api
- Package Manager: **pnpm**

---

## 🤖 Agents (recommended for this project)

| Agent | Use for |
|-------|---------|
| **code-reviewer** | General code review (all aspects) |
| **security-reviewer** | Secrets, injection, auth, uploaded-script scrubbing |
| **code-simplifier** | Refactoring & simplification |
| **refactor-cleaner** | Dead code removal |
| **architect** / **code-architect** | Feature/system design |
| **code-explorer** | Analyze codebase structure |
| **planner** | Plan feature implementation |
| **performance-optimizer** | Query/runtime optimization |
| **silent-failure-hunter** | Detect swallowed errors & silent failures |
| **tdd-guide** | Test-driven development |
| **database-reviewer** | PostgreSQL / Prisma query & schema review |
| **build-error-resolver** | Resolve build/type errors |
| **e2e-runner** | API & UI end-to-end testing |

---

## ⚙️ Config Files

- **`identity.json`** — project metadata for Claude Code context.
- **`package-manager.json`** — declares **pnpm**.
- **`launch.json`** — `web-dev` dev server (port 3000) for the preview pane.
- **`settings.local.json`** — local permission settings.

---

## 📚 Documentation

- **CLAUDE.md** (project root) — quick reference & conventions
- **server/prisma/schema.prisma** — database schema (source of truth)
- **docs/script-publish-packaging.md** — upload → scrub → review → package flow
- **.claude/rules/typescript.md** — code rules
- **.claude/rules/store-guardrails.md** — guardrails

---

**Project**: Store-HideAuto (NestJS + Prisma + PostgreSQL · Next.js + TypeScript)
