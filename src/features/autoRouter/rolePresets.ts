import type {
  AutoModelConfig,
  AutoRouterRoleConfig,
  AutoRouterRolePresetConfig,
} from '@/services/api/autoRouter';

export interface AutoRouterRolePreset {
  id: string;
  name: string;
  description: string;
  source: 'builtin' | 'custom';
  costTier: string;
  priority: number;
  strengths: string[];
  matchKeywords: string[];
  promptTemplate: string;
}

export const AUTO_ROUTER_ROLE_PRESETS: AutoRouterRolePreset[] = [
  {
    id: 'fast',
    name: '快速助手',
    description: '处理短问答、翻译、摘要、格式转换和低风险日常请求。',
    source: 'builtin',
    costTier: 'low',
    priority: 10,
    strengths: ['短问答', '翻译', '总结', '格式转换', '低成本响应'],
    matchKeywords: [
      '翻译',
      '总结',
      '摘要',
      '改写',
      '润色',
      '解释一下',
      'translate',
      'summary',
      'summarize',
      'format',
    ],
    promptTemplate:
      '你是一个快速助手角色。优先用清晰、简洁、直接的方式回答。\n适合处理短问答、翻译、摘要、格式转换和低风险日常请求。\n如果问题明显涉及代码实现、调试、架构设计或严格审查，请直接按当前上下文回答，不要声称自己已经切换到其他角色。',
  },
  {
    id: 'coding',
    name: '代码工程师',
    description: '处理代码实现、重构、仓库分析、测试补齐和开发任务拆解。',
    source: 'builtin',
    costTier: 'high',
    priority: 100,
    strengths: ['代码实现', '重构', '仓库分析', '测试补齐', '开发任务拆解'],
    matchKeywords: [
      '代码',
      '实现',
      '重构',
      '仓库',
      '函数',
      '接口',
      '组件',
      '测试',
      '单元测试',
      'go test',
      'npm test',
      'pytest',
      'typescript',
      'golang',
      'react',
      'api',
    ],
    promptTemplate:
      '你是一个代码工程师角色。优先关注实现正确性、可维护性和可验证性。\n当用户提出代码实现、重构、仓库分析、测试补齐或开发任务拆解时，先确认目标和约束，再给出具体实现方案。\n如果需要修改代码，应尽量保持变更范围小，并说明需要验证的命令或测试点。\n不要声称已经运行命令或修改文件，除非当前环境确实提供了对应能力。',
  },
  {
    id: 'debugging',
    name: '调试诊断',
    description: '处理报错、日志、构建失败、运行异常和根因定位。',
    source: 'builtin',
    costTier: 'high',
    priority: 95,
    strengths: ['错误诊断', '日志分析', '构建失败', '运行异常', '根因定位'],
    matchKeywords: [
      '报错',
      '错误',
      '异常',
      '失败',
      '崩溃',
      '日志',
      '堆栈',
      'stack trace',
      'traceback',
      'docker',
      'build failed',
      'cannot',
      'undefined',
      'panic',
      'exception',
    ],
    promptTemplate:
      '你是一个调试诊断角色。优先从错误信息、日志、堆栈、复现步骤和最近变更中定位根因。\n回答时先给出最可能原因，再给出验证方法和最小修复路径。\n如果证据不足，请明确列出需要补充的日志、命令输出、配置或相关代码位置。\n不要跳过验证思路，也不要把猜测包装成确定结论。',
  },
  {
    id: 'architecture',
    name: '架构方案',
    description: '处理系统设计、技术选型、模块边界、迁移方案和长期演进。',
    source: 'builtin',
    costTier: 'high',
    priority: 80,
    strengths: ['系统设计', '技术选型', '模块边界', '迁移方案', '长期演进'],
    matchKeywords: [
      '架构',
      '方案',
      '设计',
      '模块',
      '技术选型',
      '扩展',
      '演进',
      '重构方案',
      'design',
      'architecture',
      'migration',
      'scalability',
    ],
    promptTemplate:
      '你是一个架构方案角色。优先关注边界清晰、复杂度可控、可迁移、可观测和后续演进空间。\n回答时说明推荐方案、关键取舍、风险点和分阶段落地路径。\n如果需求可以用更简单的实现满足，应明确指出，并避免过度设计。',
  },
  {
    id: 'reviewer',
    name: '代码审查',
    description: '处理代码 Review、风险检查、回归风险、测试缺口和安全隐患。',
    source: 'builtin',
    costTier: 'medium',
    priority: 70,
    strengths: ['代码审查', '风险检查', '回归风险', '测试缺口', '安全隐患'],
    matchKeywords: [
      'review',
      '代码审查',
      '帮我看',
      '检查',
      '风险',
      '漏洞',
      '安全',
      '回归',
      '测试缺口',
      '有没有问题',
    ],
    promptTemplate:
      '你是一个代码审查角色。优先寻找真实的缺陷、回归风险、安全隐患、边界条件和测试缺口。\n回答时先列问题，按严重程度排序，并尽量给出具体文件、位置、触发条件和修复建议。\n如果没有发现明确问题，应直接说明，同时指出剩余不确定性或仍需验证的测试范围。',
  },
  {
    id: 'docs',
    name: '文档说明',
    description: '处理 README、开发文档、配置说明、发布说明和用户操作步骤。',
    source: 'builtin',
    costTier: 'medium',
    priority: 45,
    strengths: ['开发文档', '配置说明', 'README', '发布说明', '操作步骤'],
    matchKeywords: [
      '文档',
      '说明',
      'README',
      'development.md',
      '配置说明',
      '使用说明',
      '发布说明',
      'changelog',
      'docs',
      'guide',
    ],
    promptTemplate:
      '你是一个技术文档角色。优先把复杂配置、开发流程和操作步骤写得准确、可执行、易扫描。\n回答时保持结构清晰，区分背景、步骤、注意事项和验证方式。\n不要加入无法从上下文确认的承诺；如果某些命令或路径需要用户确认，请明确标出。',
  },
];

export const configPresetToPreset = (
  preset: AutoRouterRolePresetConfig
): AutoRouterRolePreset => ({
  id: preset.id,
  name: preset.name ?? preset.id,
  description: preset.description ?? '',
  source: 'custom',
  costTier: preset['cost-tier'] ?? 'medium',
  priority: preset.priority ?? 0,
  strengths: [...(preset.strengths ?? [])],
  matchKeywords: [...(preset['match-keywords'] ?? [])],
  promptTemplate: preset['prompt-template'] ?? '',
});

export const presetToConfigPreset = (
  preset: AutoRouterRolePreset
): AutoRouterRolePresetConfig => ({
  id: preset.id,
  name: preset.name,
  description: preset.description,
  'cost-tier': preset.costTier,
  priority: preset.priority,
  strengths: [...preset.strengths],
  'match-keywords': [...preset.matchKeywords],
  'prompt-template': preset.promptTemplate,
});

const presetToRole = (preset: AutoRouterRolePreset): AutoRouterRoleConfig => ({
  id: preset.id,
  name: preset.name,
  description: preset.description,
  provider: '',
  model: '',
  'cost-tier': preset.costTier,
  priority: preset.priority,
  strengths: [...preset.strengths],
  'match-keywords': [...preset.matchKeywords],
  'prompt-template': preset.promptTemplate,
});

export const createRoleFromPreset = (preset: AutoRouterRolePreset): AutoRouterRoleConfig =>
  presetToRole(preset);

export const createDefaultAutoRoles = (): AutoRouterRoleConfig[] =>
  AUTO_ROUTER_ROLE_PRESETS.map((preset) => presetToRole(preset));

export const applyPresetToRole = (
  role: AutoRouterRoleConfig,
  preset: AutoRouterRolePreset
): AutoRouterRoleConfig => ({
  ...role,
  id: !role.id?.trim() || role.id === 'new-role' ? preset.id : role.id,
  name: preset.name,
  description: preset.description,
  'cost-tier': preset.costTier,
  priority: preset.priority,
  strengths: [...preset.strengths],
  'match-keywords': [...preset.matchKeywords],
  'prompt-template': preset.promptTemplate,
});

export const createAutoModelWithRolePresets = (): AutoModelConfig => ({
  name: 'auto',
  description: '稳定的角色模型路由器',
  'default-role': 'fast',
  fallback: {
    provider: '',
    model: '',
  },
  brain: {
    provider: '',
    model: '',
    temperature: 0,
    'max-tokens': 512,
  },
  session: {
    enabled: true,
    ttl: '30m',
    'switch-threshold': 0.85,
    'max-switches': 3,
    'switch-keywords': ['new task', 'new topic', 'switch to', '重新判断', '切换角色'],
    'key-sources': [
      'metadata.execution_session_id',
      'headers.x-session-id',
      'body.metadata.user_id',
      'history-hash',
    ],
  },
  roles: createDefaultAutoRoles(),
});
