import type { AgentRole } from '../capability/contract';
import { defaultRequirements, resolveRequirements } from './role-requirements';

const ALL_ROLES: readonly AgentRole[] = [
  'intake',
  'router',
  'dev',
  'security',
  'researcher',
  'assistant',
];


describe('resolveRequirements', () => {

  it('returns a coherent default for all six roles', () => {
    for (const role of ALL_ROLES) {
      const req = resolveRequirements(role);

      expect(req.role).toBe(role);
      expect(Array.isArray(req.requiredCapabilities)).toBe(true);
      expect(req.maxPrivacyClass).toBeDefined();
      expect(req.maxCostClass).toBeDefined();
      expect(req.maxLatencyClass).toBeDefined();
    }
  });


  it('keeps intake/router conservative — local, free, realtime', () => {
    for (const role of ['intake', 'router'] as const) {
      const req = resolveRequirements(role);

      expect(req.maxPrivacyClass).toBe('local');
      expect(req.maxCostClass).toBe('free');
      expect(req.maxLatencyClass).toBe('realtime');
    }
  });


  it('declares tool use + long context for dev and security', () => {
    expect(resolveRequirements('dev').requiredCapabilities).toEqual(
      expect.arrayContaining(['toolUse', 'longContext']),
    );
    expect(resolveRequirements('security').requiredCapabilities).toEqual(
      expect.arrayContaining(['toolUse', 'longContext', 'structuredOutput']),
    );
  });


  it('applies explicit overrides for escalation without changing the role', () => {
    const req = resolveRequirements('intake', {
      maxPrivacyClass: 'public-cloud',
      maxCostClass: 'high',
      requiredCapabilities: ['toolUse'],
    });

    expect(req.role).toBe('intake');
    expect(req.maxPrivacyClass).toBe('public-cloud');
    expect(req.maxCostClass).toBe('high');
    expect(req.requiredCapabilities).toEqual(['toolUse']);
  });


  it('never lets an override reassign the role', () => {
    const req = resolveRequirements('dev', { role: 'security' } as never);

    expect(req.role).toBe('dev');
  });


  it('defaultRequirements exposes the same base as resolveRequirements with no overrides', () => {
    for (const role of ALL_ROLES) {
      expect(resolveRequirements(role)).toEqual(defaultRequirements(role));
    }
  });
});
