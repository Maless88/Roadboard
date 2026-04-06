import { describe, it, expect } from 'vitest';
import { GrantType } from '@roadboard/domain';

import { hasPermission, isAdminGrant, expandAdminGrant, EffectiveGrant } from './permissions';


describe('hasPermission', () => {

  it('returns true when grant matches', () => {
    const grants: EffectiveGrant[] = [
      { projectId: 'proj-1', grantType: GrantType.TASK_WRITE },
    ];
    expect(hasPermission(grants, 'proj-1', GrantType.TASK_WRITE)).toBe(true);
  });


  it('returns true when user has PROJECT_ADMIN (covers all)', () => {
    const grants: EffectiveGrant[] = [
      { projectId: 'proj-1', grantType: GrantType.PROJECT_ADMIN },
    ];
    expect(hasPermission(grants, 'proj-1', GrantType.TASK_WRITE)).toBe(true);
  });


  it('returns false when no matching grant', () => {
    const grants: EffectiveGrant[] = [
      { projectId: 'proj-1', grantType: GrantType.PROJECT_READ },
    ];
    expect(hasPermission(grants, 'proj-1', GrantType.TASK_WRITE)).toBe(false);
  });
});


describe('isAdminGrant', () => {

  it('returns true for PROJECT_ADMIN', () => {
    expect(isAdminGrant(GrantType.PROJECT_ADMIN)).toBe(true);
  });


  it('returns false for non-admin grants', () => {
    expect(isAdminGrant(GrantType.PROJECT_READ)).toBe(false);
  });
});


describe('expandAdminGrant', () => {

  it('returns all grant types', () => {
    const expanded = expandAdminGrant();
    const allGrantValues = Object.values(GrantType);

    for (const grant of allGrantValues) {
      expect(expanded).toContain(grant);
    }
  });
});
