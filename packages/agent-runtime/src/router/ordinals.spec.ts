import {
  COST_CLASS_ORDER,
  LATENCY_CLASS_ORDER,
  PRIVACY_CLASS_ORDER,
  costOverage,
  costRank,
  latencyOverage,
  latencyRank,
  privacyOverage,
  privacyRank,
  withinCostCeiling,
  withinLatencyCeiling,
  withinPrivacyCeiling,
} from './ordinals';


describe('privacyRank', () => {

  it('matches the ADR canonical order: local < private-cloud < public-cloud', () => {
    expect(PRIVACY_CLASS_ORDER).toEqual(['local', 'private-cloud', 'public-cloud']);
    expect(privacyRank('local')).toBeLessThan(privacyRank('private-cloud'));
    expect(privacyRank('private-cloud')).toBeLessThan(privacyRank('public-cloud'));
  });
});


describe('costRank', () => {

  it('matches the ADR canonical order: free < low < medium < high', () => {
    expect(COST_CLASS_ORDER).toEqual(['free', 'low', 'medium', 'high']);
    expect(costRank('free')).toBeLessThan(costRank('low'));
    expect(costRank('low')).toBeLessThan(costRank('medium'));
    expect(costRank('medium')).toBeLessThan(costRank('high'));
  });
});


describe('latencyRank', () => {

  it('matches the ADR canonical order: realtime < interactive < batch', () => {
    expect(LATENCY_CLASS_ORDER).toEqual(['realtime', 'interactive', 'batch']);
    expect(latencyRank('realtime')).toBeLessThan(latencyRank('interactive'));
    expect(latencyRank('interactive')).toBeLessThan(latencyRank('batch'));
  });
});


describe('withinCeiling helpers', () => {

  it('withinPrivacyCeiling is true at and below the ceiling, false above it', () => {
    expect(withinPrivacyCeiling('local', 'local')).toBe(true);
    expect(withinPrivacyCeiling('private-cloud', 'public-cloud')).toBe(true);
    expect(withinPrivacyCeiling('public-cloud', 'private-cloud')).toBe(false);
  });

  it('withinCostCeiling is true at and below the ceiling, false above it', () => {
    expect(withinCostCeiling('medium', 'medium')).toBe(true);
    expect(withinCostCeiling('low', 'high')).toBe(true);
    expect(withinCostCeiling('high', 'medium')).toBe(false);
  });

  it('withinLatencyCeiling is true at and below the ceiling, false above it', () => {
    expect(withinLatencyCeiling('interactive', 'interactive')).toBe(true);
    expect(withinLatencyCeiling('realtime', 'batch')).toBe(true);
    expect(withinLatencyCeiling('batch', 'interactive')).toBe(false);
  });
});


describe('overage helpers', () => {

  it('returns 0 when within the ceiling', () => {
    expect(privacyOverage('local', 'public-cloud')).toBe(0);
    expect(costOverage('low', 'high')).toBe(0);
    expect(latencyOverage('realtime', 'batch')).toBe(0);
  });

  it('returns the positive ordinal distance when above the ceiling', () => {
    expect(privacyOverage('public-cloud', 'local')).toBe(2);
    expect(costOverage('high', 'free')).toBe(3);
    expect(latencyOverage('batch', 'realtime')).toBe(2);
  });
});
