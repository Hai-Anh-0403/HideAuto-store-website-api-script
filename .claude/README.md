# .claude — Project Configuration for storeAutoHide

Configuration and agents for **storeAutoHide** — a FastAPI + MongoDB backend that sells
**automation scripts** (`.hideflow` workflows) for the hideflow desktop app.

Stack: **Python 3.12+ · FastAPI · MongoDB (PyMongo async + Beanie) · Pydantic v2 · uv**.
SQL (PostgreSQL) for users + transactions is planned but **not built yet**.

---

## 📁 Structure

```
.claude/
├── agents/          # code review & analysis agents
├── commands/        # workflow commands
├── rules/           # project coding rules (python.md, store-guardrails.md)
├── identity.json    # project metadata
├── package-manager.json  # uv
└── settings.local.json   # local settings
```

---

## 🚀 Commands

```bash
# New resource/endpoint (FastAPI + Beanie)
/feature-development

# MongoDB index change / data migration (Beanie)
/database-migration
```

---

## 🔧 Rules & Conventions

- **`.claude/rules/python.md`** — Python/FastAPI/Beanie conventions, structure, security.
- **`.claude/rules/store-guardrails.md`** — guardrails, commit workflow, architecture layering, review checklist.

### Identity (`identity.json`)
- Project: storeAutoHide
- Domains: python, fastapi, mongodb, beanie, rest-api
- Package Manager: **uv**
- Stack: Python + FastAPI + MongoDB (PyMongo async + Beanie) + Pydantic v2

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
| **database-reviewer** | SQL review (for the later Postgres user/transaction module) |
| **build-error-resolver** | Resolve build/tooling errors |
| **e2e-runner** | API end-to-end testing |

> TS/React-specific agents were removed — this is a Python backend.

---

## ⚙️ Config Files

- **`identity.json`** — project metadata for Claude Code context.
- **`package-manager.json`** — declares **uv**.
- **`settings.local.json`** — local settings (e.g. allow `uv run *`).

---

## 📚 Documentation

- **CLAUDE.md** (project root) — quick reference & conventions
- **docs/db/mongodb-catalog.md** — MongoDB catalog schema (now)
- **docs/db/sql-schema.md** — SQL user/transaction schema (later)
- **.claude/rules/python.md** — code rules
- **.claude/rules/store-guardrails.md** — guardrails

---

**Project**: storeAutoHide (Python + FastAPI + MongoDB script marketplace API)
