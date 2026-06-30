import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { IconSearch } from '@/components/ui/icons';
import {
  MODEL_CAPABILITY_TAG_LABELS,
  MODEL_CATALOG,
  type ModelCapabilityTag,
  type ModelCatalogEntry,
} from '@/features/modelCatalog/modelCatalog';
import styles from './ModelCatalogPage.module.scss';

const TAGS = Object.keys(MODEL_CAPABILITY_TAG_LABELS) as ModelCapabilityTag[];

const modelMatches = (
  model: ModelCatalogEntry,
  query: string,
  activeTag: ModelCapabilityTag | ''
) => {
  if (activeTag && !model.tags.includes(activeTag)) return false;
  if (!query) return true;
  const haystack = [
    model.id,
    model.name,
    model.summary,
    model.strengths,
    model.contextWindow,
    ...model.roleFit,
    ...model.tags.map((tag) => MODEL_CAPABILITY_TAG_LABELS[tag]),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

export function ModelCatalogPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<ModelCapabilityTag | ''>('');

  const normalizedQuery = query.trim().toLowerCase();
  const providers = useMemo(
    () =>
      MODEL_CATALOG.map((provider) => ({
        ...provider,
        models: provider.models.filter((model) => modelMatches(model, normalizedQuery, activeTag)),
      })).filter((provider) => provider.models.length > 0),
    [activeTag, normalizedQuery]
  );
  const modelCount = providers.reduce((sum, provider) => sum + provider.models.length, 0);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('model_catalog.title')}</h1>
          <p className={styles.description}>{t('model_catalog.description')}</p>
        </div>
        <div className={styles.countBadge}>
          {t('model_catalog.model_count', { count: modelCount })}
        </div>
      </div>

      <div className={styles.toolbar}>
        <Input
          label={t('model_catalog.search_label')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('model_catalog.search_placeholder')}
          rightElement={<IconSearch size={16} />}
        />
        <div className={styles.tagFilters} aria-label={t('model_catalog.tag_filter')}>
          <button
            type="button"
            className={`${styles.tagButton} ${activeTag === '' ? styles.tagButtonActive : ''}`}
            onClick={() => setActiveTag('')}
          >
            {t('common.all')}
          </button>
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.tagButton} ${activeTag === tag ? styles.tagButtonActive : ''}`}
              onClick={() => setActiveTag(tag)}
            >
              {MODEL_CAPABILITY_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.maintenanceNote}>
        <strong>{t('model_catalog.maintenance_title')}</strong>
        <span>{t('model_catalog.maintenance_note')}</span>
      </div>

      {providers.length === 0 && (
        <div className={styles.emptyState}>{t('model_catalog.empty')}</div>
      )}

      {providers.map((provider) => (
        <section className={styles.providerSection} key={provider.id}>
          <div className={styles.providerHeader}>
            <div>
              <h2>{provider.name}</h2>
              <p>{provider.description}</p>
            </div>
            <span>{t('model_catalog.provider_count', { count: provider.models.length })}</span>
          </div>

          <div className={styles.modelGrid}>
            {provider.models.map((model) => (
              <article className={styles.modelCard} key={model.id}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>{model.name}</h3>
                    <code>{model.id}</code>
                  </div>
                  <a href={model.sourceUrl} target="_blank" rel="noreferrer">
                    {t('model_catalog.source')}
                  </a>
                </div>

                <p className={styles.summary}>{model.summary}</p>
                <div className={styles.tags}>
                  {model.tags.map((tag) => (
                    <span className={styles.tag} key={tag}>
                      {MODEL_CAPABILITY_TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>

                <dl className={styles.facts}>
                  <div>
                    <dt>{t('model_catalog.context_window')}</dt>
                    <dd>{model.contextWindow}</dd>
                  </div>
                  <div>
                    <dt>{t('model_catalog.multimodal')}</dt>
                    <dd>{t(model.multimodal ? 'common.yes' : 'common.no')}</dd>
                  </div>
                  <div>
                    <dt>{t('model_catalog.vision')}</dt>
                    <dd>{t(model.vision ? 'common.yes' : 'common.no')}</dd>
                  </div>
                  <div>
                    <dt>{t('model_catalog.image_generation')}</dt>
                    <dd>{t(model.imageGeneration ? 'common.yes' : 'common.no')}</dd>
                  </div>
                </dl>

                <div className={styles.detailBlock}>
                  <h4>{t('model_catalog.strengths')}</h4>
                  <p>{model.strengths}</p>
                </div>
                <div className={styles.detailBlock}>
                  <h4>{t('model_catalog.role_fit')}</h4>
                  <p>{model.roleFit.join(' / ')}</p>
                </div>
                {model.notes && (
                  <div className={styles.detailBlock}>
                    <h4>{t('model_catalog.notes')}</h4>
                    <p>{model.notes}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
