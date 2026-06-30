import { describe, expect, it } from 'vitest';
import {
  applyPresetToRole,
  AUTO_ROUTER_ROLE_PRESETS,
  configPresetToPreset,
  createAutoModelWithRolePresets,
  createDefaultAutoRoles,
} from './rolePresets';

describe('auto router role presets', () => {
  it('creates role copies instead of linking default roles to preset arrays', () => {
    const roles = createDefaultAutoRoles();
    const preset = AUTO_ROUTER_ROLE_PRESETS[0];
    const role = roles[0];

    role.strengths?.push('local-only');
    role['match-keywords']?.push('local-keyword');
    role['prompt-template'] = 'local prompt';

    expect(preset.strengths).not.toContain('local-only');
    expect(preset.matchKeywords).not.toContain('local-keyword');
    expect(preset.promptTemplate).not.toBe('local prompt');
  });

  it('copies preset content into auto model roles without storing preset identity', () => {
    const model = createAutoModelWithRolePresets();
    const role = model.roles.find((item) => item.id === 'coding');

    expect(role).toMatchObject({
      id: 'coding',
      name: '代码工程师',
      provider: '',
      model: '',
    });
    expect(role).not.toHaveProperty('presetId');
    expect(role).not.toHaveProperty('preset-id');
  });

  it('includes planning and model recommendations for every built-in preset', () => {
    expect(AUTO_ROUTER_ROLE_PRESETS.some((item) => item.id === 'planning')).toBe(true);
    for (const preset of AUTO_ROUTER_ROLE_PRESETS) {
      expect(preset.modelRecommendations.length).toBeGreaterThanOrEqual(1);
      expect(preset.modelRecommendations.length).toBeLessThanOrEqual(5);
    }
  });

  it('applies a preset as an editable copy and preserves selected backend target', () => {
    const preset = AUTO_ROUTER_ROLE_PRESETS.find((item) => item.id === 'debugging');
    expect(preset).toBeDefined();

    const role = applyPresetToRole(
      {
        id: 'new-role',
        name: '新角色',
        provider: 'codex',
        model: 'gpt-5-codex',
        strengths: [],
        'match-keywords': [],
      },
      preset!
    );

    role.strengths?.push('local-only');
    role['match-keywords']?.push('local-keyword');

    expect(role).toMatchObject({
      id: 'debugging',
      name: '调试诊断',
      provider: 'codex',
      model: 'gpt-5-codex',
    });
    expect(preset!.strengths).not.toContain('local-only');
    expect(preset!.matchKeywords).not.toContain('local-keyword');
  });

  it('normalizes custom config presets into copyable preset templates', () => {
    const preset = configPresetToPreset({
      id: 'custom-debug',
      name: 'Custom Debug',
      'cost-tier': 'high',
      priority: 88,
      strengths: ['logs'],
      'match-keywords': ['panic'],
      'prompt-template': 'diagnose',
    });

    expect(preset).toMatchObject({
      id: 'custom-debug',
      name: 'Custom Debug',
      source: 'custom',
      costTier: 'high',
      priority: 88,
      promptTemplate: 'diagnose',
    });

    preset.strengths.push('local-only');
    expect(configPresetToPreset({ id: 'custom-debug', strengths: ['logs'] }).strengths).toEqual([
      'logs',
    ]);
  });
});
