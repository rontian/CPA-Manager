import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  autoRouterApi,
  createAutoModel,
  createAutoRole,
  type AutoModelConfig,
  type AutoRouterConfig,
  type AutoRouterDecision,
  type AutoRouterRoleConfig,
  type AutoRouterSessionSnapshot,
} from '@/services/api/autoRouter';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import styles from './AutoRouterPage.module.scss';

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

const normalizeError = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Request failed';

export function AutoRouterPage() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
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

  const disabled = connectionStatus !== 'connected';
  const activeModels = useMemo(() => config.models.filter((model) => model.name.trim()), [config]);
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
      ]);
      setConfig(nextConfig);
      setSessions(nextSessions);
      setDirty(false);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      models: [...current.models, createAutoModel()],
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
              {config.models.map((model, modelIndex) => (
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
                    <Input
                      label={t('auto_router.fallback_provider')}
                      value={model.fallback.provider}
                      disabled={disabled}
                      onChange={(event) =>
                        patchConfig((current) =>
                          updateModel(current, modelIndex, (item) => ({
                            ...item,
                            fallback: { ...item.fallback, provider: event.target.value },
                          }))
                        )
                      }
                    />
                    <Input
                      label={t('auto_router.fallback_model')}
                      value={model.fallback.model}
                      disabled={disabled}
                      onChange={(event) =>
                        patchConfig((current) =>
                          updateModel(current, modelIndex, (item) => ({
                            ...item,
                            fallback: { ...item.fallback, model: event.target.value },
                          }))
                        )
                      }
                    />
                  </div>

                  <div className={styles.section}>
                    <h3>{t('auto_router.brain_title')}</h3>
                    <div className={styles.formGrid}>
                      <Input
                        label={t('auto_router.brain_provider')}
                        value={model.brain.provider ?? ''}
                        disabled={disabled}
                        onChange={(event) =>
                          patchConfig((current) =>
                            updateModel(current, modelIndex, (item) => ({
                              ...item,
                              brain: { ...item.brain, provider: event.target.value },
                            }))
                          )
                        }
                      />
                      <Input
                        label={t('auto_router.brain_model')}
                        value={model.brain.model ?? ''}
                        disabled={disabled}
                        onChange={(event) =>
                          patchConfig((current) =>
                            updateModel(current, modelIndex, (item) => ({
                              ...item,
                              brain: { ...item.brain, model: event.target.value },
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
                              brain: { ...item.brain, 'max-tokens': Number(event.target.value) },
                            }))
                          )
                        }
                      />
                    </div>
                    <div className={styles.textareaGroup}>
                      <label>{t('auto_router.brain_prompt')}</label>
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
                      {model.roles.map((role, roleIndex) => (
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
                                label={!role.disabled ? t('common.enabled') : t('common.disabled')}
                              />
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
                              label={t('auto_router.role_provider')}
                              value={role.provider}
                              disabled={disabled}
                              onChange={(event) =>
                                patchConfig((current) =>
                                  updateRole(current, modelIndex, roleIndex, (item) => ({
                                    ...item,
                                    provider: event.target.value,
                                  }))
                                )
                              }
                            />
                            <Input
                              label={t('auto_router.role_model')}
                              value={role.model}
                              disabled={disabled}
                              onChange={(event) =>
                                patchConfig((current) =>
                                  updateRole(current, modelIndex, roleIndex, (item) => ({
                                    ...item,
                                    model: event.target.value,
                                  }))
                                )
                              }
                            />
                            <Input
                              label={t('auto_router.cost_tier')}
                              value={role['cost-tier'] ?? ''}
                              disabled={disabled}
                              onChange={(event) =>
                                patchConfig((current) =>
                                  updateRole(current, modelIndex, roleIndex, (item) => ({
                                    ...item,
                                    'cost-tier': event.target.value,
                                  }))
                                )
                              }
                            />
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
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
