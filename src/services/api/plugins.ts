import { apiClient } from './client';

export interface PluginMetadata {
  name?: string;
  version?: string;
  author?: string;
  github_repository?: string;
  logo?: string;
}

export interface PluginListEntry {
  id: string;
  configured?: boolean;
  registered?: boolean;
  enabled?: boolean;
  effective_enabled?: boolean;
  supports_oauth?: boolean;
  oauth_provider?: string;
  logo?: string;
  metadata?: PluginMetadata | null;
}

export interface PluginListResponse {
  plugins_enabled?: boolean;
  plugins_dir?: string;
  plugins?: PluginListEntry[];
}

export const pluginsApi = {
  list: () => apiClient.get<PluginListResponse>('/plugins'),
};
