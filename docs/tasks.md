# CPA-Manager Local Extension Tasks

## Maintenance and Merge Governance

- [x] Create a local-extension merge guide covering OAuth model aliases, provider UI changes, image/video related controls, Usage Service integration, and Auto Router.
- [x] Record branch-sync rules for keeping `main` aligned with upstream and merging into `main_ai`.
- [x] Add task/status maintenance rules to `AGENTS.md`.
- [x] Use typed Chinese commit messages for future local-extension work.

## Auto Router V1

- [x] Add Auto Router management page.
- [x] Add multi-tab Auto model configuration UI.
- [x] Add provider/model candidate inputs.
- [x] Add built-in role presets.
- [x] Add custom role preset management backed by CLIProxyAPI `auto-router.role-presets`.
- [x] Add dry-run route testing UI.
- [x] Add sticky session listing and clearing UI.

## Future Direction

- [ ] Add a richer Auto Router trace view if CLIProxyAPI exposes runtime route traces.
- [ ] Revisit Auto Router UI if upstream adds an overlapping official implementation.
