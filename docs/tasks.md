# CPA-Manager Local Extension Tasks

## Maintenance and Merge Governance

- [x] Create a local-extension merge guide covering OAuth model aliases, provider UI changes, image/video related controls, Usage Service integration, and Auto Router.
- [x] Record branch-sync rules for keeping `main` aligned with upstream and merging into `main_ai`.
- [x] Add task/status maintenance rules to `AGENTS.md`.
- [x] Use typed Chinese commit messages for future local-extension work.
- [x] Add Python-free config sync binaries for production hosts.

## Usage Service Dev Workflow

- [x] Make `make dev` reliably start both Vite and Usage Service.
- [x] Pin Usage Service dev config and SQLite data paths to the repository root.
- [x] Document root-level dev data path behavior.
- [x] Keep local Makefile commands independent from AI-only `rtk proxy`.
- [x] Support Usage Service setup under both `/setup` and `/usage-service/setup`.
- [x] Route frontend Usage Service setup calls through `/usage-service/setup`.
- [x] Proxy CPA Management API requests through Usage Service in Vite dev mode.

## Auto Router V1

- [x] Align Auto Router page container with other full-width management pages.
- [x] Add role-level tabs inside Auto Router role configuration.
- [x] Adjust Auto Router role form layout for role description and model target fields.
- [x] Add Auto Model Selection policy and role candidate pool controls.
- [x] Move Auto Router role preset management into an on-demand modal.
- [x] Filter disabled provider/auth configs out of Auto Router provider and model candidates.
- [x] Split built-in role recommendations into capability-first and value-first groups.
- [x] Rebalance built-in role recommendations toward cost-effective routing.
- [x] Exclude provider model aliases from Auto Router executable model candidates.
- [x] Keep Codex model candidate values to executable model IDs only.
- [x] Include Codex auth model definitions in Auto Router model candidates.
- [x] Adjust Auto Router brain and role model recommendation display semantics.
- [x] Add default brain judge prompt and recommended brain models for new Auto models.
- [x] Add Auto Router management page.
- [x] Add multi-tab Auto model configuration UI.
- [x] Add provider/model candidate inputs.
- [x] Add built-in role presets.
- [x] Add custom role preset management backed by CLIProxyAPI `auto-router.role-presets`.
- [x] Add dry-run route testing UI.
- [x] Add sticky session listing and clearing UI.
- [x] Add planning role preset, model recommendations, and constrained cost-tier selectors.
- [x] Refresh built-in role model recommendations for current mainstream models.
- [x] Add model capability catalog page grouped by provider.
- [x] Expand model catalog capability tags beyond role examples into a broader taxonomy.

## Future Direction

- [ ] Add a richer Auto Router trace view if CLIProxyAPI exposes runtime route traces.
- [ ] Revisit Auto Router UI if upstream adds an overlapping official implementation.
- [ ] Consider AI-assisted model catalog refresh that drafts reviewed catalog updates from official sources.
