import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  autoRouterApi,
  createAutoRole,
  type AutoModelConfig,
  type AutoRouterConfig,
  type AutoRouterDecision,
  type AutoRouterRoleConfig,
  type AutoRouterRolePresetConfig,
  type AutoRouterSessionSnapshot,
} from '@/services/api/autoRouter';
import { authFilesApi } from '@/services/api/authFiles';
import {
  applyPresetToRole,
  AUTO_ROUTER_BRAIN_MODEL_RECOMMENDATIONS,
  AUTO_ROUTER_BRAIN_PROMPT_TEMPLATE,
  AUTO_ROUTER_ROLE_PRESETS,
  configPresetToPreset,
  createAutoModelWithRolePresets,
  type AutoRouterRolePreset,
} from '@/features/autoRouter/rolePresets';
import type { Config, ModelAlias } from '@/types';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import styles from './AutoRouterPage.module.scss';

const OPENAI_COMPATIBLE_PROVIDER_PREFIX = 'openai-compatible-';
const COST_TIER_VALUES = ['low', 'medium', 'high'] as const;

const listToText = (values?: string[]) => (Array.isArray(values) ? values.join('\n') : '');

const textToList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const updateModel = (
  config: AutoRouterConfig,
  modelIndex: number,
  updater: (model: AutoModelConfig) => AutoModelConfig
): AutoRouterConfig => ({
  ...config,
  models: config.models.map((model, index) => (index === modelIndex ? updater(model) : model)),
});

const updateRole = (
  config: AutoRouterConfig,
  modelIndex: number,
  roleIndex: number,
  updater: (role: AutoRouterRoleConfig) => AutoRouterRoleConfig
): AutoRouterConfig =>
  updateModel(config, modelIndex, (model) => ({
    ...model,
    roles: model.roles.map((role, index) => (index === roleIndex ? updater(role) : role)),
  }));

const updateCustomPreset = (
  config: AutoRouterConfig,
  presetIndex: number,
  updater: (preset: AutoRouterRolePresetConfig) => AutoRouterRolePresetConfig
): AutoRouterConfig => ({
  ...config,
  'role-presets': (config['role-presets'] ?? []).map((preset, index) =>
    index === presetIndex ? updater(preset) : preset
  ),
});

const normalizeError = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Request failed';

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
};

const openAICompatibleProviderKey = (name: string) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return 'openai-compatibility';
  if (
    normalized === 'openai-compatibility' ||
    normalized.startsWith(OPENAI_COMPATIBLE_PROVIDER_PREFIX)
  ) {
    return normalized;
  }
  return `${OPENAI_COMPATIBLE_PROVIDER_PREFIX}${normalized}`;
};

const collectModelNames = (models?: ModelAlias[]) =>
  uniqueStrings(
    (models ?? []).flatMap((model) => [
      String(model.name ?? ''),
      String(model.alias ?? ''),
      String(model.testModel ?? ''),
    ])
  );

const collectDefinitionModelNames = (
  models: { id: string; display_name?: string; type?: string; owned_by?: string }[]
) => uniqueStrings(models.map((model) => model.id));

type BackendCatalog = {
  providers: string[];
  modelsByProvider: Record<string, string[]>;
  allModels: string[];
};

type ModelDefinitionsByProvider = Record<string, string[]>;

const addProviderModels = (catalog: BackendCatalog, provider: string, models: string[] = []) => {
  const normalizedProvider = provider.trim();
  if (!normalizedProvider) return;
  catalog.providers = uniqueStrings([...catalog.providers, normalizedProvider]);
  catalog.modelsByProvider[normalizedProvider] = uniqueStrings([
    ...(catalog.modelsByProvider[normalizedProvider] ?? []),
    ...models,
  ]);
  catalog.allModels = uniqueStrings([...catalog.allModels, ...models]);
};

const buildBackendCatalog = (
  managerConfig: Config | null,
  autoConfig: AutoRouterConfig,
  modelDefinitions: ModelDefinitionsByProvider
) => {
  const catalog: BackendCatalog = {
    providers: [],
    modelsByProvider: {},
    allModels: [],
  };

  addProviderModels(
    catalog,
    'gemini',
    (managerConfig?.geminiApiKeys ?? []).flatMap((item) => collectModelNames(item.models))
  );
  addProviderModels(catalog, 'codex', [
    ...(managerConfig?.codexApiKeys ?? []).flatMap((item) => collectModelNames(item.models)),
    ...(modelDefinitions.codex ?? []),
  ]);
  addProviderModels(
    catalog,
    'claude',
    (managerConfig?.claudeApiKeys ?? []).flatMap((item) => collectModelNames(item.models))
  );
  addProviderModels(
    catalog,
    'vertex',
    (managerConfig?.vertexApiKeys ?? []).flatMap((item) => collectModelNames(item.models))
  );
  addProviderModels(catalog, 'openai-compatibility');

  (managerConfig?.openaiCompatibility ?? []).forEach((provider) => {
    addProviderModels(
      catalog,
      openAICompatibleProviderKey(provider.name),
      collectModelNames(provider.models)
    );
  });

  autoConfig.models.forEach((model) => {
    addProviderModels(catalog, model.fallback.provider, [model.fallback.model]);
    addProviderModels(catalog, model.brain.provider ?? '', [model.brain.model ?? '']);
    model.roles.forEach((role) => addProviderModels(catalog, role.provider, [role.model]));
  });

  catalog.providers = uniqueStrings(catalog.providers).sort((a, b) => a.localeCompare(b));
  catalog.allModels = uniqueStrings(catalog.allModels).sort((a, b) => a.localeCompare(b));
  Object.keys(catalog.modelsByProvider).forEach((provider) => {
    catalog.modelsByProvider[provider] = uniqueStrings(catalog.modelsByProvider[provider]).sort(
      (a, b) => a.localeCompare(b)
    );
  });
  return catalog;
};

type ModelTab = 'basic' | 'brain' | 'session' | 'roles';
type PresetTab = 'builtin' | 'custom';

const modelTabs: ModelTab[] = ['basic', 'brain', 'session', 'roles'];

const createCustomPreset = (): AutoRouterRolePresetConfig => ({
  id: 'custom-role',
  name: '自定义角色',
  description: '',
  'cost-tier': 'medium',
  priority: 0,
  strengths: [],
  'match-keywords': [],
  'prompt-template': '',
});

const createUniquePresetId = (base: string, presets: AutoRouterRolePresetConfig[]) => {
  const normalizedBase = (base || 'custom-role').trim() || 'custom-role';
  const existing = new Set(presets.map((preset) => preset.id.trim()).filter(Boolean));
  if (!existing.has(normalizedBase)) return normalizedBase;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${normalizedBase}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${normalizedBase}-${Date.now()}`;
};

const roleToCustomPreset = (role: AutoRouterRoleConfig): AutoRouterRolePresetConfig => ({
  id: `${role.id || 'role'}-preset`,
  name: role.name || role.id || '自定义角色',
  description: role.description ?? '',
  'cost-tier': role['cost-tier'] ?? 'medium',
  priority: role.priority ?? 0,
  strengths: [...(role.strengths ?? [])],
  'match-keywords': [...(role['match-keywords'] ?? [])],
  'prompt-template': role['prompt-template'] ?? '',
});

const roleModelRecommendations = (
  role: AutoRouterRoleConfig,
  presets: AutoRouterRolePreset[]
): string[] => {
  const roleID = role.id.trim();
  if (!roleID) return [];
  return presets.find((preset) => preset.id === roleID)?.modelRecommendations ?? [];
};

interface CandidateInputProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

function CandidateInput({ id, label, value, options, disabled, onChange }: CandidateInputProps) {
  const visibleOptions = uniqueStrings(options);
  return (
    <>
      <Input
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        list={`${id}-options`}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={`${id}-options`}>
        {visibleOptions.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
    </>
  );
}

export function AutoRouterPage() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const managerConfig = useConfigStore((state) => state.config);
  const { showNotification } = useNotificationStore();

  const [config, setConfig] = useState<AutoRouterConfig>({ enabled: false, models: [] });
  const [sessions, setSessions] = useState<AutoRouterSessionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [dryRunModel, setDryRunModel] = useState('auto');
  const [dryRunText, setDryRunText] = useState('new task: debug this docker build failure');
  const [dryRunSession, setDryRunSession] = useState('preview-session');
  const [dryRunDecision, setDryRunDecision] = useState<AutoRouterDecision | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [activeModelTabs, setActiveModelTabs] = useState<Record<number, ModelTab>>({});
  const [activePresetTab, setActivePresetTab] = useState<PresetTab>('builtin');
  const [modelDefinitions, setModelDefinitions] = useState<ModelDefinitionsByProvider>({});

  const disabled = connectionStatus !== 'connected';
  const activeModels = useMemo(() => config.models.filter((model) => model.name.trim()), [config]);
  const customPresets = useMemo(
    () => (config['role-presets'] ?? []).map((preset) => configPresetToPreset(preset)),
    [config]
  );
  const rolePresets = useMemo<AutoRouterRolePreset[]>(
    () => [...AUTO_ROUTER_ROLE_PRESETS, ...customPresets],
    [customPresets]
  );
  const costTierOptions = useMemo(
    () =>
      COST_TIER_VALUES.map((value) => ({
        value,
        label: t(`auto_router.cost_tiers.${value}`),
      })),
    [t]
  );
  const rolePresetOptions = useMemo(
    () =>
      rolePresets.map((preset) => ({
        value: `${preset.source}:${preset.id}`,
        label: `${preset.name} (${preset.source === 'builtin' ? t('auto_router.preset_builtin') : t('auto_router.preset_custom')})`,
      })),
    [rolePresets, t]
  );
  const backendCatalog = useMemo(
    () => buildBackendCatalog(managerConfig, config, modelDefinitions),
    [managerConfig, config, modelDefinitions]
  );
  const getModelOptions = useCallback(
    (provider: string) => {
      const normalizedProvider = provider.trim();
      if (!normalizedProvider) return backendCatalog.allModels;
      return backendCatalog.modelsByProvider[normalizedProvider] ?? backendCatalog.allModels;
    },
    [backendCatalog]
  );
  const statusLabel = disabled
    ? t('auto_router.status_disconnected')
    : loading
      ? t('auto_router.status_loading')
      : dirty
        ? t('auto_router.status_dirty')
        : t('auto_router.status_ready');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextConfig, nextSessions] = await Promise.all([
        autoRouterApi.getConfig(),
        autoRouterApi.getSessions(),
        fetchConfig(undefined, true),
      ]);
      setConfig(nextConfig);
      setSessions(nextSessions);
      setDirty(false);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [fetchConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (disabled) {
      setModelDefinitions({});
      return;
    }

    let cancelled = false;
    authFilesApi
      .getModelDefinitions('codex')
      .then((models) => {
        if (cancelled) return;
        setModelDefinitions((current) => ({
          ...current,
          codex: collectDefinitionModelNames(models),
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setModelDefinitions((current) => {
          if (!current.codex) return current;
          const next = { ...current };
          delete next.codex;
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [disabled]);

  const patchConfig = (updater: (current: AutoRouterConfig) => AutoRouterConfig) => {
    setConfig((current) => updater(current));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await autoRouterApi.updateConfig(config);
      await fetchConfig(undefined, true);
      setDirty(false);
      showNotification(t('auto_router.save_success'), 'success');
      await load();
    } catch (err) {
      setError(normalizeError(err));
      showNotification(t('auto_router.save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addModel = () => {
    patchConfig((current) => ({
      ...current,
      enabled: true,
      models: [...current.models, createAutoModelWithRolePresets()],
    }));
  };

  const removeModel = (modelIndex: number) => {
    patchConfig((current) => ({
      ...current,
      models: current.models.filter((_, index) => index !== modelIndex),
    }));
  };

  const addRole = (modelIndex: number) => {
    patchConfig((current) =>
      updateModel(current, modelIndex, (model) => ({
        ...model,
        roles: [...model.roles, createAutoRole()],
      }))
    );
  };

  const removeRole = (modelIndex: number, roleIndex: number) => {
    patchConfig((current) =>
      updateModel(current, modelIndex, (model) => ({
        ...model,
        roles: model.roles.filter((_, index) => index !== roleIndex),
      }))
    );
  };

  const applyRolePreset = (modelIndex: number, roleIndex: number, presetId: string) => {
    const [source, id] = presetId.split(':');
    const preset = rolePresets.find((item) => item.source === source && item.id === id);
    if (!preset) return;
    patchConfig((current) =>
      updateRole(current, modelIndex, roleIndex, (role) => applyPresetToRole(role, preset))
    );
  };

  const addCustomPreset = () => {
    patchConfig((current) => ({
      ...current,
      'role-presets': [
        ...(current['role-presets'] ?? []),
        {
          ...createCustomPreset(),
          id: createUniquePresetId('custom-role', current['role-presets'] ?? []),
        },
      ],
    }));
    setActivePresetTab('custom');
  };

  const removeCustomPreset = (presetIndex: number) => {
    patchConfig((current) => ({
      ...current,
      'role-presets': (current['role-presets'] ?? []).filter((_, index) => index !== presetIndex),
    }));
  };

  const saveRoleAsCustomPreset = (role: AutoRouterRoleConfig) => {
    patchConfig((current) => ({
      ...current,
      'role-presets': [
        ...(current['role-presets'] ?? []),
        {
          ...roleToCustomPreset(role),
          id: createUniquePresetId(`${role.id || 'role'}-preset`, current['role-presets'] ?? []),
        },
      ],
    }));
    setActivePresetTab('custom');
  };

  const refreshSessions = async () => {
    try {
      setSessions(await autoRouterApi.getSessions());
    } catch (err) {
      showNotification(normalizeError(err), 'error');
    }
  };

  const clearSessions = async () => {
    try {
      const result = await autoRouterApi.clearSessions();
      setSessions([]);
      showNotification(t('auto_router.sessions_cleared', { count: result.cleared }), 'success');
    } catch (err) {
      showNotification(normalizeError(err), 'error');
    }
  };

  const runDryRun = async () => {
    setDryRunLoading(true);
    setDryRunDecision(null);
    try {
      const result = await autoRouterApi.dryRun({
        model: dryRunModel || 'auto',
        source_format: 'openai',
        headers: dryRunSession ? { 'X-Session-Id': [dryRunSession] } : undefined,
        body: {
          messages: [{ role: 'user', content: dryRunText }],
        },
      });
      setDryRunDecision(result.handled ? result.decision : null);
      if (!result.handled) {
        showNotification(t('auto_router.dry_run_not_handled'), 'warning');
      }
    } catch (err) {
      showNotification(normalizeError(err), 'error');
    } finally {
      setDryRunLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('auto_router.title')}</h1>
          <p className={styles.description}>{t('auto_router.description')}</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.statusBadge}>{statusLabel}</span>
          <Button variant="secondary" onClick={load} disabled={disabled || loading}>
            {t('common.refresh')}
          </Button>
          <Button onClick={save} loading={saving} disabled={disabled || !dirty || saving}>
            {t('common.save')}
          </Button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>{t('auto_router.config_title')}</h2>
                <p>{t('auto_router.config_hint')}</p>
              </div>
              <div className={styles.rowActions}>
                <ToggleSwitch
                  checked={config.enabled}
                  onChange={(enabled) => patchConfig((current) => ({ ...current, enabled }))}
                  disabled={disabled}
                  label={config.enabled ? t('common.enabled') : t('common.disabled')}
                />
                <Button variant="secondary" size="sm" onClick={addModel} disabled={disabled}>
                  {t('auto_router.add_model')}
                </Button>
              </div>
            </div>

            <div className={styles.modelsList}>
              {activeModels.length === 0 && (
                <div className={styles.emptyState}>{t('auto_router.no_models')}</div>
              )}
              {config.models.map((model, modelIndex) => {
                const activeTab = activeModelTabs[modelIndex] ?? 'basic';

                return (
                  <div className={styles.modelCard} key={`${model.name}-${modelIndex}`}>
                    <div className={styles.cardHeader}>
                      <div>
                        <h3>{model.name || t('auto_router.unnamed_model')}</h3>
                        <p>{model.description || t('auto_router.model_description_placeholder')}</p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeModel(modelIndex)}
                        disabled={disabled}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>

                    <div className={styles.modelTabs} role="tablist">
                      {modelTabs.map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={activeTab === tab}
                          className={`${styles.modelTab} ${
                            activeTab === tab ? styles.modelTabActive : ''
                          }`}
                          onClick={() =>
                            setActiveModelTabs((current) => ({
                              ...current,
                              [modelIndex]: tab,
                            }))
                          }
                        >
                          {t(`auto_router.tabs.${tab}`)}
                        </button>
                      ))}
                    </div>

                    {activeTab === 'basic' && (
                      <div className={styles.formGrid}>
                        <Input
                          label={t('auto_router.model_name')}
                          value={model.name}
                          disabled={disabled}
                          onChange={(event) =>
                            patchConfig((current) =>
                              updateModel(current, modelIndex, (item) => ({
                                ...item,
                                name: event.target.value,
                              }))
                            )
                          }
                        />
                        <Input
                          label={t('auto_router.default_role')}
                          value={model['default-role'] ?? ''}
                          disabled={disabled}
                          onChange={(event) =>
                            patchConfig((current) =>
                              updateModel(current, modelIndex, (item) => ({
                                ...item,
                                'default-role': event.target.value,
                              }))
                            )
                          }
                        />
                        <Input
                          label={t('auto_router.description_label')}
                          className={styles.fullWidth}
                          value={model.description ?? ''}
                          disabled={disabled}
                          onChange={(event) =>
                            patchConfig((current) =>
                              updateModel(current, modelIndex, (item) => ({
                                ...item,
                                description: event.target.value,
                              }))
                            )
                          }
                        />
                        <CandidateInput
                          id={`auto-router-fallback-provider-${modelIndex}`}
                          label={t('auto_router.fallback_provider')}
                          value={model.fallback.provider}
                          options={backendCatalog.providers}
                          disabled={disabled}
                          onChange={(value) =>
                            patchConfig((current) =>
                              updateModel(current, modelIndex, (item) => ({
                                ...item,
                                fallback: { ...item.fallback, provider: value },
                              }))
                            )
                          }
                        />
                        <CandidateInput
                          id={`auto-router-fallback-model-${modelIndex}`}
                          label={t('auto_router.fallback_model')}
                          value={model.fallback.model}
                          options={getModelOptions(model.fallback.provider)}
                          disabled={disabled}
                          onChange={(value) =>
                            patchConfig((current) =>
                              updateModel(current, modelIndex, (item) => ({
                                ...item,
                                fallback: { ...item.fallback, model: value },
                              }))
                            )
                          }
                        />
                        <div className={`${styles.hint} ${styles.fullWidth}`}>
                          {t('auto_router.provider_hint')}
                        </div>
                      </div>
                    )}

                    {activeTab === 'brain' && (
                      <div className={styles.section}>
                        <h3>{t('auto_router.brain_title')}</h3>
                        <div className={styles.recommendationPanel}>
                          <div>
                            <strong>{t('auto_router.brain_model_recommendations')}</strong>
                            <p>{t('auto_router.brain_model_recommendations_hint')}</p>
                          </div>
                          <div className={styles.recommendationText}>
                            {AUTO_ROUTER_BRAIN_MODEL_RECOMMENDATIONS.map(
                              (recommendation) => recommendation.model
                            ).join(' / ')}
                          </div>
                        </div>
                        <div className={styles.formGrid}>
                          <CandidateInput
                            id={`auto-router-brain-provider-${modelIndex}`}
                            label={t('auto_router.brain_provider')}
                            value={model.brain.provider ?? ''}
                            options={backendCatalog.providers}
                            disabled={disabled}
                            onChange={(value) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  brain: { ...item.brain, provider: value },
                                }))
                              )
                            }
                          />
                          <CandidateInput
                            id={`auto-router-brain-model-${modelIndex}`}
                            label={t('auto_router.brain_model')}
                            value={model.brain.model ?? ''}
                            options={getModelOptions(model.brain.provider ?? '')}
                            disabled={disabled}
                            onChange={(value) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  brain: { ...item.brain, model: value },
                                }))
                              )
                            }
                          />
                          <Input
                            label={t('auto_router.temperature')}
                            type="number"
                            step="0.1"
                            value={String(model.brain.temperature ?? 0)}
                            disabled={disabled}
                            onChange={(event) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  brain: { ...item.brain, temperature: Number(event.target.value) },
                                }))
                              )
                            }
                          />
                          <Input
                            label={t('auto_router.max_tokens')}
                            type="number"
                            value={String(model.brain['max-tokens'] ?? 512)}
                            disabled={disabled}
                            onChange={(event) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  brain: {
                                    ...item.brain,
                                    'max-tokens': Number(event.target.value),
                                  },
                                }))
                              )
                            }
                          />
                        </div>
                        <div className={styles.textareaGroup}>
                          <div className={styles.labelRow}>
                            <label>{t('auto_router.brain_prompt')}</label>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={disabled}
                              onClick={() =>
                                patchConfig((current) =>
                                  updateModel(current, modelIndex, (item) => ({
                                    ...item,
                                    brain: {
                                      ...item.brain,
                                      'prompt-template': AUTO_ROUTER_BRAIN_PROMPT_TEMPLATE,
                                    },
                                  }))
                                )
                              }
                            >
                              {t('auto_router.fill_default_brain_prompt')}
                            </Button>
                          </div>
                          <div className={styles.hint}>{t('auto_router.brain_prompt_hint')}</div>
                          <textarea
                            className={styles.textarea}
                            value={model.brain['prompt-template'] ?? ''}
                            disabled={disabled}
                            onChange={(event) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  brain: { ...item.brain, 'prompt-template': event.target.value },
                                }))
                              )
                            }
                          />
                        </div>
                      </div>
                    )}

                    {activeTab === 'session' && (
                      <div className={styles.section}>
                        <h3>{t('auto_router.session_title')}</h3>
                        <div className={styles.toolbar}>
                          <ToggleSwitch
                            checked={model.session.enabled}
                            onChange={(enabled) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  session: { ...item.session, enabled },
                                }))
                              )
                            }
                            disabled={disabled}
                            label={t('auto_router.session_enabled')}
                          />
                        </div>
                        <div className={styles.formGrid}>
                          <Input
                            label={t('auto_router.session_ttl')}
                            value={model.session.ttl ?? '30m'}
                            disabled={disabled}
                            onChange={(event) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  session: { ...item.session, ttl: event.target.value },
                                }))
                              )
                            }
                          />
                          <Input
                            label={t('auto_router.switch_threshold')}
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={String(model.session['switch-threshold'] ?? 0.85)}
                            disabled={disabled}
                            onChange={(event) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  session: {
                                    ...item.session,
                                    'switch-threshold': Number(event.target.value),
                                  },
                                }))
                              )
                            }
                          />
                          <Input
                            label={t('auto_router.max_switches')}
                            type="number"
                            min="0"
                            value={String(model.session['max-switches'] ?? 3)}
                            disabled={disabled}
                            onChange={(event) =>
                              patchConfig((current) =>
                                updateModel(current, modelIndex, (item) => ({
                                  ...item,
                                  session: {
                                    ...item.session,
                                    'max-switches': Number(event.target.value),
                                  },
                                }))
                              )
                            }
                          />
                        </div>
                        <div className={styles.formGrid}>
                          <div className={styles.textareaGroup}>
                            <label>{t('auto_router.key_sources')}</label>
                            <textarea
                              className={styles.textarea}
                              value={listToText(model.session['key-sources'])}
                              disabled={disabled}
                              onChange={(event) =>
                                patchConfig((current) =>
                                  updateModel(current, modelIndex, (item) => ({
                                    ...item,
                                    session: {
                                      ...item.session,
                                      'key-sources': textToList(event.target.value),
                                    },
                                  }))
                                )
                              }
                            />
                          </div>
                          <div className={styles.textareaGroup}>
                            <label>{t('auto_router.switch_keywords')}</label>
                            <textarea
                              className={styles.textarea}
                              value={listToText(model.session['switch-keywords'])}
                              disabled={disabled}
                              onChange={(event) =>
                                patchConfig((current) =>
                                  updateModel(current, modelIndex, (item) => ({
                                    ...item,
                                    session: {
                                      ...item.session,
                                      'switch-keywords': textToList(event.target.value),
                                    },
                                  }))
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'roles' && (
                      <div className={styles.section}>
                        <div className={styles.panelHeader}>
                          <div>
                            <h3>{t('auto_router.roles_title')}</h3>
                            <p>{t('auto_router.roles_hint')}</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => addRole(modelIndex)}
                            disabled={disabled}
                          >
                            {t('auto_router.add_role')}
                          </Button>
                        </div>
                        <div className={styles.rolesList}>
                          {model.roles.map((role, roleIndex) => {
                            const recommendations = roleModelRecommendations(role, rolePresets);
                            return (
                              <div className={styles.roleCard} key={`${role.id}-${roleIndex}`}>
                                <div className={styles.cardHeader}>
                                  <div className={styles.roleTitle}>
                                    <h3>{role.name || role.id || t('auto_router.unnamed_role')}</h3>
                                    <span className={styles.roleId}>{role.id}</span>
                                  </div>
                                  <div className={styles.rowActions}>
                                    <ToggleSwitch
                                      checked={!role.disabled}
                                      onChange={(enabled) =>
                                        patchConfig((current) =>
                                          updateRole(current, modelIndex, roleIndex, (item) => ({
                                            ...item,
                                            disabled: !enabled,
                                          }))
                                        )
                                      }
                                      disabled={disabled}
                                      label={
                                        !role.disabled ? t('common.enabled') : t('common.disabled')
                                      }
                                    />
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => saveRoleAsCustomPreset(role)}
                                      disabled={disabled}
                                    >
                                      {t('auto_router.save_role_as_preset')}
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => removeRole(modelIndex, roleIndex)}
                                      disabled={disabled}
                                    >
                                      {t('common.delete')}
                                    </Button>
                                  </div>
                                </div>
                                {recommendations.length > 0 && (
                                  <div className={styles.roleRecommendation}>
                                    <strong>{t('auto_router.model_recommendations')}</strong>
                                    <span>{recommendations.join(' / ')}</span>
                                  </div>
                                )}
                                <div className={styles.presetRow}>
                                  <div className={styles.presetSelectGroup}>
                                    <label>{t('auto_router.role_preset')}</label>
                                    <Select
                                      value=""
                                      options={rolePresetOptions}
                                      placeholder={t('auto_router.role_preset_placeholder')}
                                      onChange={(presetId) =>
                                        applyRolePreset(modelIndex, roleIndex, presetId)
                                      }
                                      disabled={disabled}
                                    />
                                  </div>
                                  <div className={styles.presetHint}>
                                    {t('auto_router.role_preset_hint')}
                                  </div>
                                </div>
                                <div className={styles.formGrid}>
                                  <Input
                                    label={t('auto_router.role_id')}
                                    value={role.id}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      patchConfig((current) =>
                                        updateRole(current, modelIndex, roleIndex, (item) => ({
                                          ...item,
                                          id: event.target.value,
                                        }))
                                      )
                                    }
                                  />
                                  <Input
                                    label={t('auto_router.role_name')}
                                    value={role.name ?? ''}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      patchConfig((current) =>
                                        updateRole(current, modelIndex, roleIndex, (item) => ({
                                          ...item,
                                          name: event.target.value,
                                        }))
                                      )
                                    }
                                  />
                                  <Input
                                    label={t('auto_router.role_description')}
                                    value={role.description ?? ''}
                                    disabled={disabled}
                                    className={styles.fullWidth}
                                    onChange={(event) =>
                                      patchConfig((current) =>
                                        updateRole(current, modelIndex, roleIndex, (item) => ({
                                          ...item,
                                          description: event.target.value,
                                        }))
                                      )
                                    }
                                  />
                                  <CandidateInput
                                    id={`auto-router-role-provider-${modelIndex}-${roleIndex}`}
                                    label={t('auto_router.role_provider')}
                                    value={role.provider}
                                    options={backendCatalog.providers}
                                    disabled={disabled}
                                    onChange={(value) =>
                                      patchConfig((current) =>
                                        updateRole(current, modelIndex, roleIndex, (item) => ({
                                          ...item,
                                          provider: value,
                                        }))
                                      )
                                    }
                                  />
                                  <CandidateInput
                                    id={`auto-router-role-model-${modelIndex}-${roleIndex}`}
                                    label={t('auto_router.role_model')}
                                    value={role.model}
                                    options={getModelOptions(role.provider)}
                                    disabled={disabled}
                                    onChange={(value) =>
                                      patchConfig((current) =>
                                        updateRole(current, modelIndex, roleIndex, (item) => ({
                                          ...item,
                                          model: value,
                                        }))
                                      )
                                    }
                                  />
                                  <div className={styles.presetSelectGroup}>
                                    <label>{t('auto_router.cost_tier')}</label>
                                    <Select
                                      value={role['cost-tier'] ?? 'medium'}
                                      options={costTierOptions}
                                      disabled={disabled}
                                      onChange={(value) =>
                                        patchConfig((current) =>
                                          updateRole(current, modelIndex, roleIndex, (item) => ({
                                            ...item,
                                            'cost-tier': value,
                                          }))
                                        )
                                      }
                                    />
                                  </div>
                                  <Input
                                    label={t('auto_router.priority')}
                                    type="number"
                                    value={String(role.priority ?? 0)}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      patchConfig((current) =>
                                        updateRole(current, modelIndex, roleIndex, (item) => ({
                                          ...item,
                                          priority: Number(event.target.value),
                                        }))
                                      )
                                    }
                                  />
                                  <div className={styles.textareaGroup}>
                                    <label>{t('auto_router.match_keywords')}</label>
                                    <textarea
                                      className={styles.textarea}
                                      value={listToText(role['match-keywords'])}
                                      disabled={disabled}
                                      onChange={(event) =>
                                        patchConfig((current) =>
                                          updateRole(current, modelIndex, roleIndex, (item) => ({
                                            ...item,
                                            'match-keywords': textToList(event.target.value),
                                          }))
                                        )
                                      }
                                    />
                                  </div>
                                  <div className={styles.textareaGroup}>
                                    <label>{t('auto_router.strengths')}</label>
                                    <textarea
                                      className={styles.textarea}
                                      value={listToText(role.strengths)}
                                      disabled={disabled}
                                      onChange={(event) =>
                                        patchConfig((current) =>
                                          updateRole(current, modelIndex, roleIndex, (item) => ({
                                            ...item,
                                            strengths: textToList(event.target.value),
                                          }))
                                        )
                                      }
                                    />
                                  </div>
                                  <div className={`${styles.textareaGroup} ${styles.fullWidth}`}>
                                    <label>{t('auto_router.role_prompt')}</label>
                                    <textarea
                                      className={styles.textarea}
                                      value={role['prompt-template'] ?? ''}
                                      disabled={disabled}
                                      onChange={(event) =>
                                        patchConfig((current) =>
                                          updateRole(current, modelIndex, roleIndex, (item) => ({
                                            ...item,
                                            'prompt-template': event.target.value,
                                          }))
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>{t('auto_router.presets_title')}</h2>
                <p>{t('auto_router.presets_hint')}</p>
              </div>
              {activePresetTab === 'custom' && (
                <Button variant="secondary" size="sm" onClick={addCustomPreset} disabled={disabled}>
                  {t('auto_router.add_custom_preset')}
                </Button>
              )}
            </div>
            <div className={styles.presetTabs} role="tablist">
              {(['builtin', 'custom'] as PresetTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activePresetTab === tab}
                  className={`${styles.presetTab} ${
                    activePresetTab === tab ? styles.presetTabActive : ''
                  }`}
                  onClick={() => setActivePresetTab(tab)}
                >
                  {t(`auto_router.presets_tabs.${tab}`)}
                </button>
              ))}
            </div>

            {activePresetTab === 'builtin' && (
              <div className={styles.presetCards}>
                {AUTO_ROUTER_ROLE_PRESETS.map((preset) => (
                  <div className={styles.presetCard} key={preset.id}>
                    <div className={styles.cardHeader}>
                      <div>
                        <h3>{preset.name}</h3>
                        <p>{preset.description}</p>
                      </div>
                      <span className={styles.roleId}>{preset.id}</span>
                    </div>
                    <div className={styles.presetMeta}>
                      <span>{t(`auto_router.cost_tiers.${preset.costTier}`)}</span>
                      <span>
                        {t('auto_router.priority')}: {preset.priority}
                      </span>
                    </div>
                    <div className={styles.hint}>{preset.strengths.join(' / ')}</div>
                    <div className={styles.hint}>
                      {t('auto_router.model_recommendations')}:{' '}
                      {preset.modelRecommendations.join(' / ')}
                    </div>
                    <div className={styles.promptPreview}>{preset.promptTemplate}</div>
                  </div>
                ))}
              </div>
            )}

            {activePresetTab === 'custom' && (
              <div className={styles.presetCards}>
                {(config['role-presets'] ?? []).length === 0 && (
                  <div className={styles.emptyState}>{t('auto_router.no_custom_presets')}</div>
                )}
                {(config['role-presets'] ?? []).map((preset, presetIndex) => (
                  <div className={styles.presetCard} key={`${preset.id}-${presetIndex}`}>
                    <div className={styles.cardHeader}>
                      <div>
                        <h3>{preset.name || preset.id || t('auto_router.unnamed_preset')}</h3>
                        <p>{preset.description || t('auto_router.custom_preset_hint')}</p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeCustomPreset(presetIndex)}
                        disabled={disabled}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                    <div className={styles.formGrid}>
                      <Input
                        label={t('auto_router.preset_id')}
                        value={preset.id}
                        disabled={disabled}
                        onChange={(event) =>
                          patchConfig((current) =>
                            updateCustomPreset(current, presetIndex, (item) => ({
                              ...item,
                              id: event.target.value,
                            }))
                          )
                        }
                      />
                      <Input
                        label={t('auto_router.preset_name')}
                        value={preset.name ?? ''}
                        disabled={disabled}
                        onChange={(event) =>
                          patchConfig((current) =>
                            updateCustomPreset(current, presetIndex, (item) => ({
                              ...item,
                              name: event.target.value,
                            }))
                          )
                        }
                      />
                      <Input
                        label={t('auto_router.preset_description')}
                        value={preset.description ?? ''}
                        className={styles.fullWidth}
                        disabled={disabled}
                        onChange={(event) =>
                          patchConfig((current) =>
                            updateCustomPreset(current, presetIndex, (item) => ({
                              ...item,
                              description: event.target.value,
                            }))
                          )
                        }
                      />
                      <div className={styles.presetSelectGroup}>
                        <label>{t('auto_router.cost_tier')}</label>
                        <Select
                          value={preset['cost-tier'] ?? 'medium'}
                          options={costTierOptions}
                          disabled={disabled}
                          onChange={(value) =>
                            patchConfig((current) =>
                              updateCustomPreset(current, presetIndex, (item) => ({
                                ...item,
                                'cost-tier': value,
                              }))
                            )
                          }
                        />
                      </div>
                      <Input
                        label={t('auto_router.priority')}
                        type="number"
                        value={String(preset.priority ?? 0)}
                        disabled={disabled}
                        onChange={(event) =>
                          patchConfig((current) =>
                            updateCustomPreset(current, presetIndex, (item) => ({
                              ...item,
                              priority: Number(event.target.value),
                            }))
                          )
                        }
                      />
                      <div className={styles.textareaGroup}>
                        <label>{t('auto_router.match_keywords')}</label>
                        <textarea
                          className={styles.textarea}
                          value={listToText(preset['match-keywords'])}
                          disabled={disabled}
                          onChange={(event) =>
                            patchConfig((current) =>
                              updateCustomPreset(current, presetIndex, (item) => ({
                                ...item,
                                'match-keywords': textToList(event.target.value),
                              }))
                            )
                          }
                        />
                      </div>
                      <div className={styles.textareaGroup}>
                        <label>{t('auto_router.strengths')}</label>
                        <textarea
                          className={styles.textarea}
                          value={listToText(preset.strengths)}
                          disabled={disabled}
                          onChange={(event) =>
                            patchConfig((current) =>
                              updateCustomPreset(current, presetIndex, (item) => ({
                                ...item,
                                strengths: textToList(event.target.value),
                              }))
                            )
                          }
                        />
                      </div>
                      <div className={`${styles.textareaGroup} ${styles.fullWidth}`}>
                        <label>{t('auto_router.role_prompt')}</label>
                        <textarea
                          className={styles.textarea}
                          value={preset['prompt-template'] ?? ''}
                          disabled={disabled}
                          onChange={(event) =>
                            patchConfig((current) =>
                              updateCustomPreset(current, presetIndex, (item) => ({
                                ...item,
                                'prompt-template': event.target.value,
                              }))
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>{t('auto_router.dry_run_title')}</h2>
                <p>{t('auto_router.dry_run_hint')}</p>
              </div>
            </div>
            <div className={styles.formGrid}>
              <Input
                label={t('auto_router.dry_run_model')}
                value={dryRunModel}
                disabled={disabled}
                onChange={(event) => setDryRunModel(event.target.value)}
              />
              <Input
                label={t('auto_router.dry_run_session')}
                value={dryRunSession}
                disabled={disabled}
                onChange={(event) => setDryRunSession(event.target.value)}
              />
              <div className={`${styles.textareaGroup} ${styles.fullWidth}`}>
                <label>{t('auto_router.dry_run_text')}</label>
                <textarea
                  className={styles.textarea}
                  value={dryRunText}
                  disabled={disabled}
                  onChange={(event) => setDryRunText(event.target.value)}
                />
              </div>
            </div>
            <div className={styles.toolbar}>
              <Button
                onClick={runDryRun}
                loading={dryRunLoading}
                disabled={disabled || dryRunLoading}
              >
                {t('auto_router.run_dry_run')}
              </Button>
            </div>
            {dryRunDecision && (
              <div className={styles.decisionBox}>
                <strong>{dryRunDecision.role_id}</strong>
                <span>
                  {dryRunDecision.provider}/{dryRunDecision.model}
                </span>
                <span>{dryRunDecision.reason || t('common.not_set')}</span>
                <span>
                  {dryRunDecision.sticky
                    ? t('auto_router.sticky_hit')
                    : t('auto_router.new_decision')}
                </span>
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>{t('auto_router.sessions_title')}</h2>
                <p>{t('auto_router.sessions_hint')}</p>
              </div>
            </div>
            <div className={styles.toolbar}>
              <Button variant="secondary" size="sm" onClick={refreshSessions} disabled={disabled}>
                {t('common.refresh')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={clearSessions}
                disabled={disabled || sessions.length === 0}
              >
                {t('auto_router.clear_sessions')}
              </Button>
            </div>
            <div className={styles.sessionsList}>
              {sessions.length === 0 && (
                <div className={styles.emptyState}>{t('auto_router.no_sessions')}</div>
              )}
              {sessions.map((session) => (
                <div className={styles.sessionItem} key={session.key}>
                  <strong>
                    {session.auto_model} {'->'} {session.role_id}
                  </strong>
                  <span>
                    {session.provider}/{session.model}
                  </span>
                  <span>{session.reason || t('common.not_set')}</span>
                  <span>{t('auto_router.switch_count', { count: session.switch_count })}</span>
                  <span>{new Date(session.expires_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
