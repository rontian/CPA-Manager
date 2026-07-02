import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNotificationStore, useThemeStore } from '@/stores';
import { oauthApi, type OAuthProvider } from '@/services/api/oauth';
import { pluginsApi, type PluginListEntry } from '@/services/api/plugins';
import { vertexApi, type VertexImportResponse } from '@/services/api/vertex';
import { copyToClipboard } from '@/utils/clipboard';
import styles from './OAuthPage.module.scss';
import iconCodex from '@/assets/icons/codex.svg';
import iconClaude from '@/assets/icons/claude.svg';
import iconAntigravity from '@/assets/icons/antigravity.svg';
import iconGemini from '@/assets/icons/gemini.svg';
import iconKimiLight from '@/assets/icons/kimi-light.svg';
import iconKimiDark from '@/assets/icons/kimi-dark.svg';
import iconVertex from '@/assets/icons/vertex.svg';
import iconGrok from '@/assets/icons/grok.svg';
import iconGrokDark from '@/assets/icons/grok-dark.svg';

interface ProviderState {
  url?: string;
  state?: string;
  metadata?: Record<string, unknown>;
  status?: 'idle' | 'starting' | 'waiting' | 'success' | 'error';
  statusMessage?: string;
  error?: string;
  polling?: boolean;
  projectId?: string;
  projectIdError?: string;
  callbackUrl?: string;
  callbackSubmitting?: boolean;
  callbackStatus?: 'success' | 'error';
  callbackError?: string;
}

interface OAuthDisplayProvider {
  id: string;
  title: string;
  hint: string;
  urlLabel: string;
  icon?: string | { light: string; dark: string };
  isPlugin?: boolean;
  callbackSupported: boolean;
}

interface PluginOAuthProvider {
  id: string;
  title: string;
  hint: string;
  urlLabel: string;
  icon?: string;
}

interface VertexImportResult {
  projectId?: string;
  email?: string;
  location?: string;
  authFile?: string;
}

interface VertexImportState {
  file?: File;
  fileName: string;
  location: string;
  loading: boolean;
  error?: string;
  result?: VertexImportResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return typeof error === 'string' ? error : '';
}

function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

const PROVIDERS: {
  id: OAuthProvider;
  titleKey: string;
  hintKey: string;
  urlLabelKey: string;
  icon: string | { light: string; dark: string };
}[] = [
  {
    id: 'codex',
    titleKey: 'auth_login.codex_oauth_title',
    hintKey: 'auth_login.codex_oauth_hint',
    urlLabelKey: 'auth_login.codex_oauth_url_label',
    icon: iconCodex,
  },
  {
    id: 'anthropic',
    titleKey: 'auth_login.anthropic_oauth_title',
    hintKey: 'auth_login.anthropic_oauth_hint',
    urlLabelKey: 'auth_login.anthropic_oauth_url_label',
    icon: iconClaude,
  },
  {
    id: 'antigravity',
    titleKey: 'auth_login.antigravity_oauth_title',
    hintKey: 'auth_login.antigravity_oauth_hint',
    urlLabelKey: 'auth_login.antigravity_oauth_url_label',
    icon: iconAntigravity,
  },
  {
    id: 'gemini-cli',
    titleKey: 'auth_login.gemini_cli_oauth_title',
    hintKey: 'auth_login.gemini_cli_oauth_hint',
    urlLabelKey: 'auth_login.gemini_cli_oauth_url_label',
    icon: iconGemini,
  },
  {
    id: 'kimi',
    titleKey: 'auth_login.kimi_oauth_title',
    hintKey: 'auth_login.kimi_oauth_hint',
    urlLabelKey: 'auth_login.kimi_oauth_url_label',
    icon: { light: iconKimiLight, dark: iconKimiDark },
  },
  {
    id: 'xai',
    titleKey: 'auth_login.xai_oauth_title',
    hintKey: 'auth_login.xai_oauth_hint',
    urlLabelKey: 'auth_login.xai_oauth_url_label',
    icon: { light: iconGrok, dark: iconGrokDark },
  },
];

const CALLBACK_SUPPORTED: OAuthProvider[] = [
  'codex',
  'anthropic',
  'antigravity',
  'gemini-cli',
  'xai',
];
const BUILTIN_PROVIDER_IDS = new Set<string>(PROVIDERS.map((provider) => provider.id));
const XAI_CALLBACK_URL = 'http://127.0.0.1:56121/callback';
const SUCCESS_RESET_DELAY_MS = 5000;
const getProviderI18nPrefix = (provider: OAuthProvider) => provider.replace('-', '_');
const getAuthKey = (provider: OAuthProvider, suffix: string) =>
  `auth_login.${getProviderI18nPrefix(provider)}_${suffix}`;

const isBuiltinProvider = (provider: string): provider is OAuthProvider =>
  BUILTIN_PROVIDER_IDS.has(provider);

const pluginTitle = (plugin: PluginListEntry): string => {
  const title = plugin.metadata?.name?.trim() || plugin.oauth_provider?.trim() || plugin.id;
  return title || plugin.id;
};

const pluginOAuthProvider = (plugin: PluginListEntry): PluginOAuthProvider | null => {
  if (!plugin.effective_enabled || !plugin.supports_oauth || !plugin.oauth_provider) return null;
  const id = plugin.oauth_provider.trim();
  if (!id || BUILTIN_PROVIDER_IDS.has(id)) return null;
  const title = pluginTitle(plugin);
  return {
    id,
    title,
    hint: '',
    urlLabel: '',
    icon: plugin.logo || plugin.metadata?.logo || undefined,
  };
};

const getIcon = (
  icon: string | { light: string; dark: string } | undefined,
  theme: 'light' | 'dark'
) => {
  if (!icon) return undefined;
  return typeof icon === 'string' ? icon : icon[theme];
};

const isAbsoluteUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const readQueryLikeCallbackInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const queryStart = trimmed.indexOf('?');
  const hashStart = trimmed.indexOf('#');
  const rawParams =
    queryStart >= 0
      ? trimmed.slice(queryStart + 1)
      : hashStart >= 0
        ? trimmed.slice(hashStart + 1)
        : trimmed;

  if (!/(^|[&#?])(code|state|error)=/i.test(rawParams)) return null;
  return new URLSearchParams(rawParams.replace(/^[?#]/, ''));
};

const extractDisplayedXaiCode = (value: string): string => {
  const trimmed = value.trim();
  const codeMatch = trimmed.match(/\bcode\s*[:=]\s*([^\s&]+)/i);
  return (codeMatch?.[1] ?? trimmed).trim();
};

const buildXaiCallbackUrl = (input: string, state?: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isAbsoluteUrl(trimmed)) return trimmed;

  const params = readQueryLikeCallbackInput(trimmed);
  if (params) {
    const code = params.get('code')?.trim();
    const error = params.get('error')?.trim();
    const errorDescription = params.get('error_description')?.trim();
    const callbackState = params.get('state')?.trim() || state?.trim();
    if (!callbackState) return null;

    const callbackUrl = new URL(XAI_CALLBACK_URL);
    callbackUrl.searchParams.set('state', callbackState);
    if (code) callbackUrl.searchParams.set('code', code);
    if (error) callbackUrl.searchParams.set('error', error);
    if (errorDescription) callbackUrl.searchParams.set('error_description', errorDescription);
    return callbackUrl.toString();
  }

  const code = extractDisplayedXaiCode(trimmed);
  const callbackState = state?.trim();
  if (!code || !callbackState) return null;

  const callbackUrl = new URL(XAI_CALLBACK_URL);
  callbackUrl.searchParams.set('code', code);
  callbackUrl.searchParams.set('state', callbackState);
  return callbackUrl.toString();
};

const resolveCallbackUrl = (
  provider: OAuthProvider,
  input: string,
  state?: string
): string | null => {
  if (provider !== 'xai') return input.trim();
  return buildXaiCallbackUrl(input, state);
};

export function OAuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const [states, setStates] = useState<Record<string, ProviderState>>({});
  const [pluginProviders, setPluginProviders] = useState<PluginOAuthProvider[]>([]);
  const [pluginLoadError, setPluginLoadError] = useState<string>('');
  const [vertexState, setVertexState] = useState<VertexImportState>({
    fileName: '',
    location: '',
    loading: false,
  });
  const pollingTimers = useRef<Record<string, number | undefined>>({});
  const successResetTimers = useRef<Record<string, number | undefined>>({});
  const vertexFileInputRef = useRef<HTMLInputElement | null>(null);

  const clearTimers = useCallback(() => {
    Object.values(pollingTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearInterval(timer);
    });
    Object.values(successResetTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearTimeout(timer);
    });
    pollingTimers.current = {};
    successResetTimers.current = {};
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    let cancelled = false;
    const loadPlugins = async () => {
      try {
        const res = await pluginsApi.list();
        if (cancelled) return;
        const oauthPlugins = (res.plugins || [])
          .map(pluginOAuthProvider)
          .filter((item): item is PluginOAuthProvider => Boolean(item));
        setPluginProviders(oauthPlugins);
        setPluginLoadError('');
      } catch (err: unknown) {
        if (cancelled) return;
        setPluginProviders([]);
        setPluginLoadError(getErrorMessage(err));
      }
    };
    void loadPlugins();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProviderState = (provider: string, next: Partial<ProviderState>) => {
    setStates((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] ?? {}), ...next },
    }));
  };

  const clearPollingTimer = (provider: string) => {
    const timer = pollingTimers.current[provider];
    if (timer !== undefined) {
      window.clearInterval(timer);
      delete pollingTimers.current[provider];
    }
  };

  const clearSuccessResetTimer = (provider: string) => {
    const timer = successResetTimers.current[provider];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete successResetTimers.current[provider];
    }
  };

  const clearProviderTimers = (provider: string) => {
    clearPollingTimer(provider);
    clearSuccessResetTimer(provider);
  };

  const resetProviderAttempt = (provider: string) => {
    clearProviderTimers(provider);
    setStates((prev) => {
      const current = prev[provider] ?? {};
      const next: ProviderState = {};
      if (provider === 'gemini-cli' && current.projectId !== undefined) {
        next.projectId = current.projectId;
      }
      return {
        ...prev,
        [provider]: next,
      };
    });
  };

  const getProviderTitle = useCallback(
    (provider: string) => {
      if (isBuiltinProvider(provider)) return t(getAuthKey(provider, 'oauth_title'));
      return pluginProviders.find((item) => item.id === provider)?.title || provider;
    },
    [pluginProviders, t]
  );

  const getProviderText = useCallback(
    (provider: string, suffix: string, fallback: string) => {
      if (isBuiltinProvider(provider))
        return t(getAuthKey(provider, suffix), { defaultValue: fallback });
      return t(`auth_login.plugin_${suffix}`, {
        provider: getProviderTitle(provider),
        defaultValue: fallback,
      });
    },
    [getProviderTitle, t]
  );

  const completeProviderAuth = (provider: string) => {
    clearPollingTimer(provider);
    clearSuccessResetTimer(provider);
    updateProviderState(provider, {
      url: undefined,
      state: undefined,
      status: 'success',
      statusMessage: undefined,
      error: undefined,
      polling: false,
      callbackUrl: '',
      callbackSubmitting: false,
      callbackStatus: undefined,
      callbackError: undefined,
    });
    successResetTimers.current[provider] = window.setTimeout(() => {
      resetProviderAttempt(provider);
    }, SUCCESS_RESET_DELAY_MS);
  };

  const startPolling = (provider: string, state: string, intervalSeconds?: number) => {
    clearPollingTimer(provider);
    let pollIntervalMs = Math.max(5, intervalSeconds || 5) * 1000;
    const scheduleNext = () => {
      pollingTimers.current[provider] = window.setTimeout(pollOnce, pollIntervalMs);
    };
    const stopPolling = () => {
      const timer = pollingTimers.current[provider];
      if (timer !== undefined) {
        window.clearTimeout(timer);
        delete pollingTimers.current[provider];
      }
    };
    const pollOnce = async () => {
      try {
        const res = await oauthApi.getAuthStatus(state);
        if (res.status === 'ok') {
          stopPolling();
          completeProviderAuth(provider);
          showNotification(
            getProviderText(
              provider,
              'oauth_status_success',
              `${getProviderTitle(provider)} 认证成功！`
            ),
            'success'
          );
        } else if (res.status === 'error') {
          updateProviderState(provider, {
            status: 'error',
            statusMessage: undefined,
            error: res.error,
            polling: false,
          });
          showNotification(
            `${getProviderText(provider, 'oauth_status_error', '认证失败:')} ${res.error || ''}`,
            'error'
          );
          stopPolling();
        } else if (res.status === 'wait') {
          if (/slow down/i.test(res.message || '')) {
            pollIntervalMs += 5000;
          }
          updateProviderState(provider, {
            status: 'waiting',
            statusMessage: res.message,
          });
          scheduleNext();
        }
      } catch (err: unknown) {
        updateProviderState(provider, {
          status: 'error',
          statusMessage: undefined,
          error: getErrorMessage(err),
          polling: false,
        });
        stopPolling();
      }
    };
    scheduleNext();
  };

  const startAuth = async (provider: string) => {
    clearProviderTimers(provider);
    const geminiState = provider === 'gemini-cli' ? states[provider] : undefined;
    const rawProjectId = provider === 'gemini-cli' ? (geminiState?.projectId || '').trim() : '';
    const projectId = rawProjectId
      ? rawProjectId.toUpperCase() === 'ALL'
        ? 'ALL'
        : rawProjectId
      : undefined;
    // 项目 ID 可选：留空自动选择第一个可用项目；输入 ALL 获取全部项目
    if (provider === 'gemini-cli') {
      updateProviderState(provider, { projectIdError: undefined });
    }
    updateProviderState(provider, {
      url: undefined,
      state: undefined,
      metadata: undefined,
      status: 'starting',
      statusMessage: undefined,
      polling: true,
      error: undefined,
      callbackStatus: undefined,
      callbackError: undefined,
      callbackUrl: '',
    });
    try {
      const res = await oauthApi.startAuth(
        provider,
        provider === 'gemini-cli' ? { projectId: projectId || undefined } : undefined
      );
      if (!res.state) {
        const message = t('auth_login.missing_state');
        updateProviderState(provider, {
          url: res.url,
          state: undefined,
          metadata: res.metadata,
          status: 'error',
          statusMessage: undefined,
          error: message,
          polling: false,
        });
        showNotification(message, 'error');
        return;
      }
      updateProviderState(provider, {
        url: res.url,
        state: res.state,
        metadata: res.metadata,
        status: 'waiting',
        statusMessage: undefined,
        polling: true,
      });
      const interval =
        typeof res.metadata?.interval === 'number' && Number.isFinite(res.metadata.interval)
          ? res.metadata.interval
          : undefined;
      startPolling(provider, res.state, interval);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      updateProviderState(provider, {
        status: 'error',
        statusMessage: undefined,
        error: message,
        polling: false,
      });
      showNotification(
        `${getProviderText(provider, 'oauth_start_error', `启动 ${getProviderTitle(provider)} OAuth 失败:`)}${message ? ` ${message}` : ''}`,
        'error'
      );
    }
  };

  const copyLink = async (url?: string) => {
    if (!url) return;
    const copied = await copyToClipboard(url);
    showNotification(
      t(copied ? 'notification.link_copied' : 'notification.copy_failed'),
      copied ? 'success' : 'error'
    );
  };

  const submitCallback = async (provider: string) => {
    const callbackInput = (states[provider]?.callbackUrl || '').trim();
    if (!callbackInput) {
      showNotification(
        t(
          provider === 'xai'
            ? 'auth_login.xai_callback_required'
            : 'auth_login.oauth_callback_required'
        ),
        'warning'
      );
      return;
    }
    const redirectUrl = resolveCallbackUrl(
      isBuiltinProvider(provider) ? provider : 'codex',
      callbackInput,
      states[provider]?.state
    );
    if (!redirectUrl) {
      showNotification(
        t(
          provider === 'xai' ? 'auth_login.xai_callback_state_missing' : 'auth_login.missing_state'
        ),
        'warning'
      );
      return;
    }
    updateProviderState(provider, {
      callbackSubmitting: true,
      callbackStatus: undefined,
      callbackError: undefined,
    });
    try {
      await oauthApi.submitCallback(provider, redirectUrl);
      updateProviderState(provider, { callbackSubmitting: false, callbackStatus: 'success' });
      showNotification(t('auth_login.oauth_callback_success'), 'success');
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      const message = getErrorMessage(err);
      const errorMessage =
        status === 404
          ? t('auth_login.oauth_callback_upgrade_hint', {
              defaultValue: 'Please update CLI Proxy API or check the connection.',
            })
          : message || undefined;
      updateProviderState(provider, {
        callbackSubmitting: false,
        callbackStatus: 'error',
        callbackError: errorMessage,
      });
      const notificationMessage = errorMessage
        ? `${t('auth_login.oauth_callback_error')} ${errorMessage}`
        : t('auth_login.oauth_callback_error');
      showNotification(notificationMessage, 'error');
    }
  };

  const handleVertexFilePick = () => {
    vertexFileInputRef.current?.click();
  };

  const handleVertexFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      showNotification(t('vertex_import.file_required'), 'warning');
      event.target.value = '';
      return;
    }
    setVertexState((prev) => ({
      ...prev,
      file,
      fileName: file.name,
      error: undefined,
      result: undefined,
    }));
    event.target.value = '';
  };

  const handleVertexImport = async () => {
    if (!vertexState.file) {
      const message = t('vertex_import.file_required');
      setVertexState((prev) => ({ ...prev, error: message }));
      showNotification(message, 'warning');
      return;
    }
    const location = vertexState.location.trim();
    setVertexState((prev) => ({ ...prev, loading: true, error: undefined, result: undefined }));
    try {
      const res: VertexImportResponse = await vertexApi.importCredential(
        vertexState.file,
        location || undefined
      );
      const result: VertexImportResult = {
        projectId: res.project_id,
        email: res.email,
        location: res.location,
        authFile: res['auth-file'] ?? res.auth_file,
      };
      setVertexState((prev) => ({ ...prev, loading: false, result }));
      showNotification(t('vertex_import.success'), 'success');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setVertexState((prev) => ({
        ...prev,
        loading: false,
        error: message || t('notification.upload_failed'),
      }));
      const notification = message
        ? `${t('notification.upload_failed')}: ${message}`
        : t('notification.upload_failed');
      showNotification(notification, 'error');
    }
  };

  const displayProviders: OAuthDisplayProvider[] = [
    ...PROVIDERS.map((provider) => ({
      id: provider.id,
      title: t(provider.titleKey),
      hint: t(provider.hintKey),
      urlLabel: t(provider.urlLabelKey),
      icon: provider.icon,
      callbackSupported: CALLBACK_SUPPORTED.includes(provider.id),
    })),
    ...pluginProviders.map((provider) => ({
      id: provider.id,
      title: provider.title,
      hint: t('auth_login.plugin_oauth_hint', {
        provider: provider.title,
        defaultValue: `通过插件认证 ${provider.title}，自动获取并保存认证文件。`,
      }),
      urlLabel: t('auth_login.plugin_oauth_url_label', { defaultValue: '授权链接:' }),
      icon: provider.icon,
      isPlugin: true,
      callbackSupported: true,
    })),
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>

      <div className={styles.content}>
        {pluginLoadError && (
          <div className="status-badge error">
            {t('auth_login.plugin_load_error', {
              message: pluginLoadError,
              defaultValue: `插件认证入口加载失败: ${pluginLoadError}`,
            })}
          </div>
        )}

        {displayProviders.map((provider) => {
          const state = states[provider.id] || {};
          const isDeviceFlow =
            state.metadata?.flow === 'device' || typeof state.metadata?.user_code === 'string';
          const userCode =
            typeof state.metadata?.user_code === 'string' ? state.metadata.user_code : '';
          const canSubmitCallback =
            provider.callbackSupported && Boolean(state.url) && !isDeviceFlow;
          const loginButtonLabel =
            state.status === 'success'
              ? t('auth_login.login_another_account')
              : state.status === 'starting'
                ? getProviderText(provider.id, 'oauth_status_starting', '正在获取授权链接...')
                : getProviderText(provider.id, 'oauth_button', `开始 ${provider.title} 登录`);
          const statusBadgeClassName = [
            'status-badge',
            state.status === 'success' ? 'success' : '',
            state.status === 'error' ? 'error' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={provider.id}>
              <Card
                title={
                  <span className={styles.cardTitle}>
                    {getIcon(provider.icon, resolvedTheme) ? (
                      <img
                        src={getIcon(provider.icon, resolvedTheme)}
                        alt=""
                        className={styles.cardTitleIcon}
                      />
                    ) : (
                      <span className={styles.cardTitleFallbackIcon}>
                        {provider.title.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    {provider.title}
                  </span>
                }
                extra={
                  <Button onClick={() => startAuth(provider.id)} loading={state.polling}>
                    {loginButtonLabel}
                  </Button>
                }
              >
                <div className={styles.cardContent}>
                  <div className={styles.cardHint}>{provider.hint}</div>
                  {provider.id === 'gemini-cli' && (
                    <div className={styles.geminiProjectField}>
                      <Input
                        label={t('auth_login.gemini_cli_project_id_label')}
                        hint={t('auth_login.gemini_cli_project_id_hint')}
                        value={state.projectId || ''}
                        error={state.projectIdError}
                        disabled={Boolean(state.polling)}
                        onChange={(e) =>
                          updateProviderState(provider.id, {
                            projectId: e.target.value,
                            projectIdError: undefined,
                          })
                        }
                        placeholder={t('auth_login.gemini_cli_project_id_placeholder')}
                      />
                    </div>
                  )}
                  {state.url && (
                    <div className={styles.authUrlBox}>
                      <div className={styles.authUrlLabel}>{provider.urlLabel}</div>
                      <div className={styles.authUrlValue}>{state.url}</div>
                      {userCode && (
                        <div className={styles.deviceCodeBox}>
                          <span className={styles.deviceCodeLabel}>
                            {t('auth_login.plugin_device_code_label', { defaultValue: '设备码' })}
                          </span>
                          <code className={styles.deviceCodeValue}>{userCode}</code>
                        </div>
                      )}
                      <div className={styles.authUrlActions}>
                        <Button variant="secondary" size="sm" onClick={() => copyLink(state.url!)}>
                          {getProviderText(provider.id, 'copy_link', '复制链接')}
                        </Button>
                        {userCode && (
                          <Button variant="secondary" size="sm" onClick={() => copyLink(userCode)}>
                            {t('auth_login.plugin_copy_device_code', {
                              defaultValue: '复制设备码',
                            })}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(state.url, '_blank', 'noopener,noreferrer')}
                        >
                          {getProviderText(provider.id, 'open_link', '打开链接')}
                        </Button>
                      </div>
                    </div>
                  )}
                  {canSubmitCallback && (
                    <div className={styles.callbackSection}>
                      <Input
                        label={t(
                          provider.id === 'xai'
                            ? 'auth_login.xai_callback_label'
                            : 'auth_login.oauth_callback_label'
                        )}
                        hint={t(
                          provider.id === 'xai'
                            ? 'auth_login.xai_callback_hint'
                            : 'auth_login.oauth_callback_hint'
                        )}
                        value={state.callbackUrl || ''}
                        onChange={(e) =>
                          updateProviderState(provider.id, {
                            callbackUrl: e.target.value,
                            callbackStatus: undefined,
                            callbackError: undefined,
                          })
                        }
                        placeholder={t(
                          provider.id === 'xai'
                            ? 'auth_login.xai_callback_placeholder'
                            : 'auth_login.oauth_callback_placeholder'
                        )}
                      />
                      <div className={styles.callbackActions}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => submitCallback(provider.id)}
                          loading={state.callbackSubmitting}
                        >
                          {t('auth_login.oauth_callback_button')}
                        </Button>
                      </div>
                      {state.callbackStatus === 'success' && state.status === 'waiting' && (
                        <div className="status-badge success">
                          {t('auth_login.oauth_callback_status_success')}
                        </div>
                      )}
                      {state.callbackStatus === 'error' && (
                        <div className="status-badge error">
                          {t('auth_login.oauth_callback_status_error')} {state.callbackError || ''}
                        </div>
                      )}
                    </div>
                  )}
                  {state.status && state.status !== 'idle' && (
                    <div className={statusBadgeClassName}>
                      {state.status === 'success'
                        ? getProviderText(
                            provider.id,
                            'oauth_status_success',
                            `${provider.title} 认证成功！`
                          )
                        : state.status === 'error'
                          ? `${getProviderText(provider.id, 'oauth_status_error', '认证失败:')} ${state.error || ''}`
                          : state.status === 'starting'
                            ? getProviderText(
                                provider.id,
                                'oauth_status_starting',
                                '正在获取授权链接...'
                              )
                            : state.statusMessage
                              ? `${getProviderText(provider.id, 'oauth_status_waiting', '等待认证中...')} ${state.statusMessage}`
                              : getProviderText(
                                  provider.id,
                                  'oauth_status_waiting',
                                  '等待认证中...'
                                )}
                    </div>
                  )}
                  {state.status === 'success' && (
                    <div className={styles.successActions}>
                      <Button variant="secondary" size="sm" onClick={() => navigate('/auth-files')}>
                        {t('auth_login.view_auth_files')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          );
        })}

        {/* Vertex JSON 登录 */}
        <Card
          title={
            <span className={styles.cardTitle}>
              <img src={iconVertex} alt="" className={styles.cardTitleIcon} />
              {t('vertex_import.title')}
            </span>
          }
          extra={
            <Button onClick={handleVertexImport} loading={vertexState.loading}>
              {t('vertex_import.import_button')}
            </Button>
          }
        >
          <div className={styles.cardContent}>
            <div className={styles.cardHint}>{t('vertex_import.description')}</div>
            <Input
              label={t('vertex_import.location_label')}
              hint={t('vertex_import.location_hint')}
              value={vertexState.location}
              onChange={(e) =>
                setVertexState((prev) => ({
                  ...prev,
                  location: e.target.value,
                }))
              }
              placeholder={t('vertex_import.location_placeholder')}
            />
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>{t('vertex_import.file_label')}</label>
              <div className={styles.filePicker}>
                <Button variant="secondary" size="sm" onClick={handleVertexFilePick}>
                  {t('vertex_import.choose_file')}
                </Button>
                <div
                  className={`${styles.fileName} ${
                    vertexState.fileName ? '' : styles.fileNamePlaceholder
                  }`.trim()}
                >
                  {vertexState.fileName || t('vertex_import.file_placeholder')}
                </div>
              </div>
              <div className={styles.cardHintSecondary}>{t('vertex_import.file_hint')}</div>
              <input
                ref={vertexFileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleVertexFileChange}
              />
            </div>
            {vertexState.error && <div className="status-badge error">{vertexState.error}</div>}
            {vertexState.result && (
              <div className={styles.connectionBox}>
                <div className={styles.connectionLabel}>{t('vertex_import.result_title')}</div>
                <div className={styles.keyValueList}>
                  {vertexState.result.projectId && (
                    <div className={styles.keyValueItem}>
                      <span className={styles.keyValueKey}>
                        {t('vertex_import.result_project')}
                      </span>
                      <span className={styles.keyValueValue}>{vertexState.result.projectId}</span>
                    </div>
                  )}
                  {vertexState.result.email && (
                    <div className={styles.keyValueItem}>
                      <span className={styles.keyValueKey}>{t('vertex_import.result_email')}</span>
                      <span className={styles.keyValueValue}>{vertexState.result.email}</span>
                    </div>
                  )}
                  {vertexState.result.location && (
                    <div className={styles.keyValueItem}>
                      <span className={styles.keyValueKey}>
                        {t('vertex_import.result_location')}
                      </span>
                      <span className={styles.keyValueValue}>{vertexState.result.location}</span>
                    </div>
                  )}
                  {vertexState.result.authFile && (
                    <div className={styles.keyValueItem}>
                      <span className={styles.keyValueKey}>{t('vertex_import.result_file')}</span>
                      <span className={styles.keyValueValue}>{vertexState.result.authFile}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
