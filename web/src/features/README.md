# Feature modules

- Each feature owns its components, hooks, model, and public `index.ts` API.
- A feature imports only from `shared/*` or another feature's public API.
- Do not place route-specific composition or feature logic in `src/app`.
