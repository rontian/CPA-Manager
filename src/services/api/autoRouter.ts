import { apiClient } from './client';

export interface AutoRouteTargetConfig {
  provider: string;
  model: string;
}

export interface AutoRouterBrainConfig {
  provider?: string;
  model?: string;
  'prompt-template'?: string;
  temperature?: number;
  'max-tokens'?: number;
}

export interface AutoRouterSessionConfig {
  enabled: boolean;
  ttl?: string;
  'switch-threshold'?: number;
  'max-switches'?: number;
  'switch-keywords'?: string[];
  'key-sources'?: string[];
  'fallback-history-hash'?: boolean;
}

export interface AutoRouterRoleConfig {
  id: string;
  name?: string;
  description?: string;
  provider: string;
  model: string;
  'cost-tier'?: string;
  priority?: number;
  strengths?: string[];
  'match-keywords'?: string[];
  'prompt-template'?: string;
  disabled?: boolean;
}

export interface AutoModelConfig {
  name: string;
  description?: string;
  'default-role'?: string;
  fallback: AutoRouteTargetConfig;
  brain: AutoRouterBrainConfig;
  session: AutoRouterSessionConfig;
  roles: AutoRouterRoleConfig[];
}

export interface AutoRouterConfig {
  enabled: boolean;
  models: AutoModelConfig[];
}

export interface AutoRouterSessionSnapshot {
  key: string;
  auto_model: string;
  role_id: string;
  provider: string;
  model: string;
  reason?: string;
  switch_count: number;
  expires_at: string;
}

export interface AutoRouterDecision {
  provider: string;
  model: string;
  role_id: string;
  reason?: string;
  prompt_template?: string;
  confidence?: number;
  brain: boolean;
  sticky: boolean;
}

export interface AutoRouterDryRunRequest {
  model: string;
  source_format: string;
  stream?: boolean;
  headers?: Record<string, string[]>;
  body?: unknown;
}

export interface AutoRouterDryRunResponse {
  handled: boolean;
  decision: AutoRouterDecision;
}

const emptyAutoRouterConfig = (): AutoRouterConfig => ({
  enabled: false,
  models: [],
});

export const createAutoModel = (): AutoModelConfig => ({
  name: 'auto',
  description: 'Stable role-based model router',
  'default-role': 'fast',
  fallback: {
    provider: 'claude',
    model: 'claude-sonnet-4-5',
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
    'switch-keywords': ['new task', 'new topic', 'switch to'],
    'key-sources': [
      'metadata.execution_session_id',
      'headers.x-session-id',
      'body.metadata.user_id',
      'history-hash',
    ],
  },
  roles: [
    {
      id: 'fast',
      name: 'Fast Agent',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      'cost-tier': 'low',
      priority: 10,
      strengths: ['short Q&A', 'translation', 'summary'],
      'match-keywords': ['translate', 'summary'],
      'prompt-template': 'You are a fast assistant. Answer clearly and concisely.',
    },
    {
      id: 'coding',
      name: 'Coding Agent',
      provider: 'codex',
      model: 'gpt-5-codex',
      'cost-tier': 'high',
      priority: 100,
      strengths: ['code editing', 'debugging', 'repo analysis'],
      'match-keywords': ['stack trace', 'docker', 'go test'],
      'prompt-template': 'You are a senior coding assistant. Focus on implementation correctness.',
    },
  ],
});

export const createAutoRole = (): AutoRouterRoleConfig => ({
  id: 'new-role',
  name: 'New Role',
  provider: '',
  model: '',
  'cost-tier': 'medium',
  priority: 0,
  strengths: [],
  'match-keywords': [],
  'prompt-template': '',
});

export const autoRouterApi = {
  async getConfig(): Promise<AutoRouterConfig> {
    const data = await apiClient.get<{
      'auto-router'?: AutoRouterConfig;
      autoRouter?: AutoRouterConfig;
    }>('/auto-router');
    return data?.['auto-router'] ?? data?.autoRouter ?? emptyAutoRouterConfig();
  },

  updateConfig: (config: AutoRouterConfig) =>
    apiClient.put('/auto-router', {
      'auto-router': config,
    }),

  deleteConfig: () => apiClient.delete('/auto-router'),

  async getSessions(): Promise<AutoRouterSessionSnapshot[]> {
    const data = await apiClient.get<{ sessions?: AutoRouterSessionSnapshot[] }>(
      '/auto-router/sessions'
    );
    return Array.isArray(data?.sessions) ? data.sessions : [];
  },

  clearSessions: () => apiClient.delete<{ cleared: number }>('/auto-router/sessions'),

  dryRun: (request: AutoRouterDryRunRequest) =>
    apiClient.post<AutoRouterDryRunResponse>('/auto-router/dry-run', request),
};
