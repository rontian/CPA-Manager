# AGENTS.md

React/Vite management UI for CLIProxyAPI. The `main` branch tracks upstream; `main_ai` carries local extensions.

## Commands

```bash
npm run type-check
npm run build
npm run test
npx vitest run src/features/autoRouter/rolePresets.test.ts
```

Usage Service development commands are available through `Makefile`.

## Local Extension Workflow

- Before starting a non-trivial task, update `docs/tasks.md` with the plan/status entry for that task.
- Keep task statuses current during implementation, and record follow-up direction when relevant.
- When updating or adding local extensions that may affect upstream merges, update `docs/local-extension-merge-guide_CN.md` in the same change.
- `main` should stay aligned with upstream. Local extensions should be maintained on `main_ai`, and upstream updates should be merged from `main` into `main_ai`.

## Commit Rules

- Git commit messages for local extension work must use a typed format with Chinese description.
- Examples:
  - `feat(auto-router): 增加角色预设管理`
  - `fix(auth-files): 修复 OAuth 模型别名保存`
  - `docs(merge): 新增管理端合并指南`
  - `chore(ui): 调整 Auto 路由页面宽度`

## Code Conventions

- Prefer existing local patterns and services over new abstractions.
- Keep UI changes consistent with the current design system.
- For Auto Router, built-in presets are code-owned and read-only; custom presets are saved through CLIProxyAPI `auto-router.role-presets`.
- Applying a role preset must copy data into the role instance. Do not store live preset references in Auto model roles.
