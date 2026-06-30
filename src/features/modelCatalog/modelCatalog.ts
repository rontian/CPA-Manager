export type ModelCapabilityTag =
  | 'fast'
  | 'flagship'
  | 'cost-effective'
  | 'reasoning'
  | 'math'
  | 'data-analysis'
  | 'coding'
  | 'debugging'
  | 'architecture'
  | 'planning'
  | 'review'
  | 'docs'
  | 'writing'
  | 'chinese'
  | 'tool-use'
  | 'agent'
  | 'vision'
  | 'multimodal'
  | 'image-generation'
  | 'image-editing'
  | 'long-context';

export interface ModelCatalogEntry {
  id: string;
  name: string;
  summary: string;
  strengths: string;
  tags: ModelCapabilityTag[];
  roleFit: string[];
  multimodal: boolean;
  vision: boolean;
  imageGeneration: boolean;
  contextWindow: string;
  notes?: string;
  sourceUrl: string;
}

export interface ModelProviderCatalog {
  id: string;
  name: string;
  description: string;
  models: ModelCatalogEntry[];
}

export const MODEL_CAPABILITY_TAG_LABELS: Record<ModelCapabilityTag, string> = {
  fast: '快速',
  flagship: '旗舰',
  'cost-effective': '性价比',
  reasoning: '推理',
  math: '数学',
  'data-analysis': '数据分析',
  coding: '代码',
  debugging: '调试',
  architecture: '架构',
  planning: '规划',
  review: '审查',
  docs: '文档',
  writing: '写作',
  chinese: '中文优化',
  'tool-use': '工具调用',
  agent: '智能体',
  vision: '图像理解',
  multimodal: '多模态',
  'image-generation': '图像生成',
  'image-editing': '图像编辑',
  'long-context': '长上下文',
};

export const MODEL_CATALOG: ModelProviderCatalog[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: '通用推理、代码、规划和多模态能力强，适合作为高价值任务的默认上限模型池。',
    models: [
      {
        id: 'gpt-5.5',
        name: 'GPT-5.5',
        summary: 'OpenAI 主力旗舰通用模型，适合复杂推理、规划、代码和跨领域分析。',
        strengths: '复杂任务拆解、架构设计、代码实现、长文档综合和高质量审查。',
        tags: [
          'flagship',
          'reasoning',
          'math',
          'data-analysis',
          'coding',
          'debugging',
          'architecture',
          'planning',
          'review',
          'tool-use',
          'agent',
          'multimodal',
        ],
        roleFit: ['规划分析', '架构方案', '代码工程师', '代码审查'],
        multimodal: true,
        vision: true,
        imageGeneration: false,
        contextWindow: '以 OpenAI 模型页为准',
        notes: '适合作为 Auto Router 高优先级通用强模型。',
        sourceUrl: 'https://platform.openai.com/docs/models',
      },
      {
        id: 'gpt-image-2',
        name: 'GPT Image 2',
        summary: 'OpenAI 图像生成与编辑模型，适合视觉资产和创意图像生产。',
        strengths: '图像生成、图像编辑、视觉素材草案和多轮图像修改。',
        tags: ['image-generation', 'image-editing', 'multimodal'],
        roleFit: ['图像生成', '文档说明'],
        multimodal: true,
        vision: true,
        imageGeneration: true,
        contextWindow: '图像任务参数以 OpenAI 模型页为准',
        sourceUrl: 'https://platform.openai.com/docs/models',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: '长文档理解、审查、规划和严谨写作表现稳定，适合高风险分析类角色。',
    models: [
      {
        id: 'claude-opus-4.8',
        name: 'Claude Opus 4.8',
        summary: 'Claude 系列旗舰模型，偏强推理、代码审查、复杂规划和文档分析。',
        strengths: '代码审查、风险分析、长文档归纳、架构取舍和复杂规划。',
        tags: [
          'flagship',
          'reasoning',
          'coding',
          'debugging',
          'architecture',
          'planning',
          'review',
          'docs',
          'writing',
          'vision',
          'long-context',
        ],
        roleFit: ['代码审查', '架构方案', '规划分析', '文档说明'],
        multimodal: true,
        vision: true,
        imageGeneration: false,
        contextWindow: '以 Anthropic 模型页为准',
        sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/models/overview',
      },
      {
        id: 'claude-sonnet-4.7',
        name: 'Claude Sonnet 4.7',
        summary: '高性能均衡模型，适合日常代码、文档和分析任务。',
        strengths: '代码修改、调试分析、文档整理和中高复杂度问答。',
        tags: ['coding', 'debugging', 'review', 'docs', 'writing', 'vision', 'multimodal'],
        roleFit: ['代码工程师', '调试诊断', '文档说明'],
        multimodal: true,
        vision: true,
        imageGeneration: false,
        contextWindow: '以 Anthropic 模型页为准',
        sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/models/overview',
      },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: '多模态、长上下文和快速响应覆盖面广，适合快速角色和视觉理解任务。',
    models: [
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        summary: 'Gemini 快速档模型，适合低延迟问答、摘要、翻译和轻量多模态任务。',
        strengths: '快速响应、摘要翻译、轻量规划、图像理解和批量文本处理。',
        tags: ['fast', 'cost-effective', 'docs', 'writing', 'vision', 'multimodal', 'long-context'],
        roleFit: ['快速助手', '文档说明'],
        multimodal: true,
        vision: true,
        imageGeneration: false,
        contextWindow: '以 Google Gemini 模型页为准',
        sourceUrl: 'https://ai.google.dev/gemini-api/docs/models',
      },
      {
        id: 'gemini-3.5-pro',
        name: 'Gemini 3.5 Pro',
        summary: 'Gemini 高能力通用模型，适合复杂分析、多模态理解和长上下文任务。',
        strengths: '长上下文、多模态分析、架构规划、代码理解和知识综合。',
        tags: [
          'reasoning',
          'data-analysis',
          'architecture',
          'planning',
          'coding',
          'tool-use',
          'vision',
          'multimodal',
          'long-context',
        ],
        roleFit: ['架构方案', '规划分析', '代码工程师'],
        multimodal: true,
        vision: true,
        imageGeneration: false,
        contextWindow: '以 Google Gemini 模型页为准',
        sourceUrl: 'https://ai.google.dev/gemini-api/docs/models',
      },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '性价比和代码/推理能力突出，适合成本敏感的代码、调试和快速分析任务。',
    models: [
      {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        summary: 'DeepSeek 高能力推理模型，适合代码、调试、规划和复杂问答。',
        strengths: '代码实现、调试诊断、推理分析和结构化输出。',
        tags: ['reasoning', 'coding', 'debugging', 'planning', 'review', 'cost-effective'],
        roleFit: ['代码工程师', '调试诊断', '规划分析'],
        multimodal: false,
        vision: false,
        imageGeneration: false,
        contextWindow: '以 DeepSeek API 文档为准',
        sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
      },
      {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        summary: 'DeepSeek 快速档模型，适合低成本问答、摘要和轻量代码任务。',
        strengths: '快速问答、简单代码、摘要改写和轻量分析。',
        tags: ['fast', 'cost-effective', 'coding', 'docs', 'writing'],
        roleFit: ['快速助手', '文档说明'],
        multimodal: false,
        vision: false,
        imageGeneration: false,
        contextWindow: '以 DeepSeek API 文档为准',
        sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
      },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen',
    description: '中文、代码、工具调用和多模态生态覆盖广，适合国内部署和中文场景。',
    models: [
      {
        id: 'qwen3.7-max',
        name: 'Qwen3.7 Max',
        summary: 'Qwen Max 档通用强模型，适合中文复杂任务、代码和规划分析。',
        strengths: '中文任务、代码实现、功能规划、架构分析和文档生成。',
        tags: [
          'reasoning',
          'coding',
          'debugging',
          'architecture',
          'planning',
          'docs',
          'writing',
          'chinese',
          'tool-use',
        ],
        roleFit: ['代码工程师', '规划分析', '架构方案', '文档说明'],
        multimodal: false,
        vision: false,
        imageGeneration: false,
        contextWindow: '以阿里云百炼模型页为准',
        sourceUrl: 'https://help.aliyun.com/zh/model-studio/getting-started/models',
      },
      {
        id: 'qwen-image',
        name: 'Qwen Image',
        summary: 'Qwen 图像生成模型，适合中文提示词下的图像创作和视觉资产生成。',
        strengths: '中文图像生成、视觉素材、海报草图和图文创意。',
        tags: ['image-generation', 'image-editing', 'multimodal', 'chinese'],
        roleFit: ['图像生成', '文档说明'],
        multimodal: true,
        vision: true,
        imageGeneration: true,
        contextWindow: '图像任务参数以阿里云百炼模型页为准',
        sourceUrl: 'https://help.aliyun.com/zh/model-studio/getting-started/models',
      },
    ],
  },
  {
    id: 'zai',
    name: 'Z.ai / GLM',
    description: '中文推理、代码和综合任务能力强，适合规划、架构和中文文档场景。',
    models: [
      {
        id: 'glm-5.2',
        name: 'GLM-5.2',
        summary: 'GLM 系列高能力通用模型，适合中文复杂分析、代码和规划任务。',
        strengths: '中文推理、规划分析、架构讨论、代码理解和文档写作。',
        tags: [
          'reasoning',
          'math',
          'data-analysis',
          'coding',
          'architecture',
          'planning',
          'docs',
          'writing',
          'chinese',
        ],
        roleFit: ['规划分析', '架构方案', '代码工程师', '文档说明'],
        multimodal: false,
        vision: false,
        imageGeneration: false,
        contextWindow: '以 Z.ai 文档为准',
        sourceUrl: 'https://docs.z.ai/guides/llm/glm-5.2',
      },
    ],
  },
];
