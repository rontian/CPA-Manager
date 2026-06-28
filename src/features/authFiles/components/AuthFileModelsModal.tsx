import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AuthFileModelItem } from '@/features/authFiles/constants';
import { isModelExcluded } from '@/features/authFiles/constants';
import type { AuthFileItem } from '@/types';
import styles from '@/pages/AuthFilesPage.module.scss';

export type AuthFileModelsModalProps = {
  open: boolean;
  fileName: string;
  fileType: string;
  loading: boolean;
  error: 'unsupported' | null;
  models: AuthFileModelItem[];
  excluded: Record<string, string[]>;
  authFileItem: AuthFileItem | null;
  onClose: () => void;
  onCopyText: (text: string) => void;
  onSaveAliases: (aliases: { name: string; alias: string }[]) => Promise<void>;
};

export function AuthFileModelsModal(props: AuthFileModelsModalProps) {
  const { t } = useTranslation();
  const {
    open,
    fileName,
    fileType,
    loading,
    error,
    models,
    excluded,
    authFileItem,
    onClose,
    onCopyText,
    onSaveAliases
  } = props;

  const [editedAliases, setEditedAliases] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Initialize aliases from authFileItem metadata
  useEffect(() => {
    if (authFileItem && open) {
      const initial: Record<string, string> = {};
      const list = authFileItem['model-aliases'] || [];
      list.forEach((entry) => {
        initial[entry.name] = entry.alias;
      });
      setEditedAliases(initial);
    } else {
      setEditedAliases({});
    }
  }, [authFileItem, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const aliasList = Object.entries(editedAliases)
        .map(([name, alias]) => ({ name, alias: alias.trim() }))
        .filter((entry) => entry.alias); // Only keep non-empty aliases
      await onSaveAliases(aliasList);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={720}
      title={t('auth_files.models_title', { defaultValue: '支持的模型' }) + ` - ${fileName}`}
      footer={
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
            {saving
              ? t('common.saving', { defaultValue: '正在保存...' })
              : t('common.save', { defaultValue: '保存别名' })}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className={styles.hint}>
          {t('auth_files.models_loading', { defaultValue: '正在加载模型列表...' })}
        </div>
      ) : error === 'unsupported' ? (
        <EmptyState
          title={t('auth_files.models_unsupported', { defaultValue: '当前版本不支持此功能' })}
          description={t('auth_files.models_unsupported_desc', {
            defaultValue: '请更新 CLI Proxy API 到最新版本后重试'
          })}
        />
      ) : models.length === 0 ? (
        <EmptyState
          title={t('auth_files.models_empty', { defaultValue: '该凭证暂无可用模型' })}
          description={t('auth_files.models_empty_desc', {
            defaultValue: '该认证凭证可能尚未被服务器加载或没有绑定任何模型'
          })}
        />
      ) : (
        <div className={styles.modelsList}>
          {models.map((model) => {
            const excludedModel = isModelExcluded(model.id, fileType, excluded);
            return (
              <div
                key={model.id}
                className={`${styles.modelItem} ${excludedModel ? styles.modelItemExcluded : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'nowrap',
                  gap: '16px',
                  padding: '10px 16px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  onCopyText(model.id);
                }}
                title={
                  excludedModel
                    ? t('auth_files.models_excluded_hint', {
                        defaultValue: '此 OAuth 模型已被禁用'
                      })
                    : t('common.copy', { defaultValue: '点击复制 ID' })
                }
              >
                {/* Left side: Model Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                  <span className={styles.modelId} style={{ fontSize: '13px', lineHeight: '1.2' }}>
                    {model.id}
                  </span>
                  {model.display_name && model.display_name !== model.id && (
                    <span className={styles.modelDisplayName} style={{ fontSize: '11px', lineHeight: '1.2', margin: 0 }}>
                      {model.display_name}
                    </span>
                  )}
                </div>
                
                {/* Right side: Input, Type and Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editedAliases[model.id] || ''}
                    onChange={(e) => {
                      setEditedAliases({
                        ...editedAliases,
                        [model.id]: e.target.value
                      });
                    }}
                    placeholder={t('auth_files.alias_placeholder', { defaultValue: '设置别名...' })}
                    className={styles.modelAliasInput}
                    style={{
                      margin: 0,
                      width: '160px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  />

                  {model.type && (
                    <span 
                      className={styles.modelType} 
                      style={{ 
                        margin: 0, 
                        fontSize: '11px',
                        backgroundColor: 'var(--bg-tertiary)',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}
                    >
                      {model.type}
                    </span>
                  )}

                  {excludedModel && (
                    <span className={styles.modelExcludedBadge} style={{ margin: 0, fontSize: '10px' }}>
                      {t('auth_files.models_excluded_badge', { defaultValue: '已禁用' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
