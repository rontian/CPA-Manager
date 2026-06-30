# CPA-Manager 本地扩展合并指南

本文用于在 `main` 同步官方 CPA-Manager 后，将官方变更合并到本地扩展分支 `main_ai`。管理端的主要风险来自路由、导航、i18n、配置编辑 UI 和服务 API 类型变化。

## 分支模型

- `main`：只跟随官方仓库。
- `main_ai`：本地扩展分支。
- 同步流程：

```bash
git checkout main
git pull upstream main

git checkout main_ai
git merge main
```

如果官方 remote 名称不同，替换 `upstream`。

## 本地扩展总览

| 扩展 | 主要页面/模块 | 重点文件 | 合并关注点 |
| --- | --- | --- | --- |
| API Key 别名和 Usage Service 展示 | Usage/Monitoring 相关页面 | `src/features/monitoring/*`、`src/services/api/usageService.ts`、`usage-service/*` | 官方若改 Usage 数据结构，确认别名映射、历史统计和 sqlite/data 目录仍一致 |
| OAuth 模型别名 | Auth Files 模型别名编辑 | `src/pages/AuthFilesOAuthModelAliasEditPage.tsx`、`src/services/api/authFiles.ts`、`src/types/oauth.ts`、i18n | 合并时确认 auth JSON `model-aliases` 读写、图形化别名编辑、升级提示仍可用 |
| OAuth 排除模型 | Auth Files 排除模型编辑 | `src/pages/AuthFilesOAuthExcludedEditPage.tsx`、`src/services/api/authFiles.ts`、i18n | 官方若改认证文件接口，确认排除模型仍 patch 到正确字段 |
| OpenAI 兼容提供商模型配置 | AI Providers | `src/pages/AiProvidersOpenAIEditPage.tsx`、`src/pages/AiProvidersOpenAIModelsPage.tsx`、`src/services/api/providers.ts` | 保留 provider/model alias、模型发现、OpenAI-compatible provider key 规则 |
| 图片/视频相关配置 | 配置页、provider 模型识别 | `src/pages/ConfigPage.tsx`、`src/i18n/locales/*`、API services | 官方新增图片/视频配置项时，避免覆盖本地启发式模型关键词和开关说明 |
| Auto Router | Auto Router 页面和预设管理 | `src/pages/AutoRouterPage.tsx`、`src/features/autoRouter/*`、`src/services/api/autoRouter.ts`、`src/router/MainRoutes.tsx`、`src/components/layout/MainLayout.tsx` | 官方若新增自动路由或模型策略页面，需要判断合并、迁移或保留本地实现 |

## 高风险文件

- `src/router/MainRoutes.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/en.json`
- `src/services/api/index.ts`
- `src/services/api/providers.ts`
- `src/services/api/authFiles.ts`
- `src/services/api/autoRouter.ts`
- `src/pages/AutoRouterPage.tsx`
- `src/features/autoRouter/rolePresets.ts`
- `src/pages/AuthFilesOAuthModelAliasEditPage.tsx`
- `src/pages/AuthFilesOAuthExcludedEditPage.tsx`
- `src/pages/AiProvidersOpenAIEditPage.tsx`

## 合并判断规则

- 导航和路由冲突不能简单选一边，要保留官方新增入口并接回本地入口。
- i18n 冲突要按 key 合并，避免覆盖官方新文案或丢失本地文案。
- API service 类型冲突要以 CLIProxyAPI 实际返回结构为准。
- 内置角色预设属于 CPA-Manager 代码，随项目升级；自定义角色预设保存在 CLIProxyAPI `auto-router.role-presets`，不能混写到前端本地状态。
- Auto Router 角色套用预设始终是复制，不保存预设引用，不修改原始内置预设。
- 如果官方新增同类 Auto/Agent 功能，先做功能差异表，再决定迁移或保留本地页面。

## 最小验证清单

每次合并官方变更到 `main_ai` 后至少运行：

```bash
npm run type-check
npm run build
```

如果冲突涉及 Auto Router：

```bash
npx vitest run src/features/autoRouter/rolePresets.test.ts
```

如果冲突涉及 Usage Service、Auth Files、Providers 或 Monitoring，运行相关测试：

```bash
npm run test
```

如果全量测试存在已知非本次引入失败，需要在合并记录中说明。

## 任务和提交规则

- 开始合并或功能任务前，先更新 `docs/tasks.md`，新增计划项并标注状态。
- 任务过程中持续更新状态，完成后把已完成项标为 `[x]`。
- 提交信息使用带类型的中文说明，例如：
  - `feat(auto-router): 增加角色预设管理`
  - `fix(auth-files): 修复 OAuth 模型别名保存`
  - `docs(merge): 新增管理端合并指南`
  - `chore(ui): 调整 Auto 路由页面宽度`

## 后续维护

新增本地管理端扩展时，需要同步更新本文：

- 页面或模块入口
- API service 和类型
- i18n key
- 与 CLIProxyAPI 配置/API 的关系
- 合并官方变更时的风险点
- 必跑验证命令
