/**
 * OAuth 与设备码登录相关 API
 */

import { apiClient } from './client';

export type OAuthProvider = 'codex' | 'anthropic' | 'antigravity' | 'gemini-cli' | 'kimi' | 'xai';

export interface OAuthStartResponse {
  url: string;
  state?: string;
  metadata?: Record<string, unknown>;
}

export interface OAuthCallbackResponse {
  status: 'ok';
}

const WEBUI_SUPPORTED: OAuthProvider[] = ['codex', 'anthropic', 'antigravity', 'gemini-cli', 'xai'];
const CALLBACK_PROVIDER_MAP: Partial<Record<OAuthProvider, string>> = {
  'gemini-cli': 'gemini',
};

const isWebuiSupportedProvider = (provider: string): provider is OAuthProvider =>
  WEBUI_SUPPORTED.includes(provider as OAuthProvider);

export const oauthApi = {
  startAuth: (provider: string, options?: { projectId?: string }) => {
    const params: Record<string, string | boolean> = {};
    if (isWebuiSupportedProvider(provider)) {
      params.is_webui = true;
    }
    if (provider === 'gemini-cli' && options?.projectId) {
      params.project_id = options.projectId;
    }
    return apiClient.get<OAuthStartResponse>(`/${provider}-auth-url`, {
      params: Object.keys(params).length ? params : undefined,
    });
  },

  getAuthStatus: (state: string) =>
    apiClient.get<{ status: 'ok' | 'wait' | 'error'; error?: string; message?: string }>(
      `/get-auth-status`,
      {
        params: { state },
      }
    ),

  submitCallback: (provider: string, redirectUrl: string) => {
    const callbackProvider = CALLBACK_PROVIDER_MAP[provider as OAuthProvider] ?? provider;
    return apiClient.post<OAuthCallbackResponse>('/oauth-callback', {
      provider: callbackProvider,
      redirect_url: redirectUrl,
    });
  },
};
