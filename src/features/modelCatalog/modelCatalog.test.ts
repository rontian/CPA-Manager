import { describe, expect, it } from 'vitest';
import { MODEL_CATALOG } from './modelCatalog';

describe('model catalog', () => {
  it('keeps each provider group within the intended catalog size', () => {
    for (const provider of MODEL_CATALOG) {
      expect(provider.models.length).toBeGreaterThanOrEqual(1);
      expect(provider.models.length).toBeLessThanOrEqual(10);
    }
  });

  it('describes capabilities and role fit for every model', () => {
    for (const provider of MODEL_CATALOG) {
      for (const model of provider.models) {
        expect(model.tags.length).toBeGreaterThan(0);
        expect(model.roleFit.length).toBeGreaterThan(0);
        expect(model.summary.trim()).not.toBe('');
        expect(model.strengths.trim()).not.toBe('');
      }
    }
  });
});
