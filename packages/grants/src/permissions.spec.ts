import { describe, it, expect } from 'vitest';
import { GrantType } from '@roadboard/domain';

import {
  hasPermission,
  isAdminGrant,
  expandAdminGrant,
  filterGrantsByTeamRole,
  isInheritableByTeamMember,
  EffectiveGrant,
} from './permissions';


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


describe('filterGrantsByTeamRole', () => {

  const grants: EffectiveGrant[] = [
    { projectId: 'p1', grantType: GrantType.PROJECT_ADMIN },
    { projectId: 'p1', grantType: GrantType.TOKEN_MANAGE },
    { projectId: 'p1', grantType: GrantType.CODEFLOW_SCAN },
    { projectId: 'p1', grantType: GrantType.PROJECT_WRITE },
    { projectId: 'p1', grantType: GrantType.TASK_WRITE },
    { projectId: 'p1', grantType: GrantType.MEMORY_WRITE },
  ];


  it('team admin inherits every grant unchanged', () => {
    expect(filterGrantsByTeamRole(grants, 'admin')).toEqual(grants);
  });


  it('team member: privileged grants (token.manage, codeflow.scan) are dropped', () => {

    const filtered = filterGrantsByTeamRole(grants, 'member');
    const types = filtered.map((g) => g.grantType);

    expect(types).not.toContain(GrantType.PROJECT_ADMIN);
    expect(types).not.toContain(GrantType.TOKEN_MANAGE);
    expect(types).not.toContain(GrantType.CODEFLOW_SCAN);
  });


  it('team member: project.admin is downgraded to full operational set', () => {

    const onlyAdmin: EffectiveGrant[] = [
      { projectId: 'p2', grantType: GrantType.PROJECT_ADMIN },
    ];
    const filtered = filterGrantsByTeamRole(onlyAdmin, 'member');
    const types = filtered.map((g) => g.grantType);

    expect(types).toContain(GrantType.PROJECT_READ);
    expect(types).toContain(GrantType.PROJECT_WRITE);
    expect(types).toContain(GrantType.TASK_WRITE);
    expect(types).toContain(GrantType.MEMORY_WRITE);
    expect(types).toContain(GrantType.DECISION_WRITE);
    expect(types).toContain(GrantType.DASHBOARD_READ);
    expect(types).toContain(GrantType.CODEFLOW_READ);
    expect(types).toContain(GrantType.CODEFLOW_WRITE);
    expect(types).not.toContain(GrantType.PROJECT_ADMIN);
    expect(types).not.toContain(GrantType.TOKEN_MANAGE);
    expect(types).not.toContain(GrantType.CODEFLOW_SCAN);
    for (const g of filtered) expect(g.projectId).toBe('p2');
  });


  it('isInheritableByTeamMember rejects privileged grants', () => {
    expect(isInheritableByTeamMember(GrantType.PROJECT_ADMIN)).toBe(false);
    expect(isInheritableByTeamMember(GrantType.TOKEN_MANAGE)).toBe(false);
    expect(isInheritableByTeamMember(GrantType.CODEFLOW_SCAN)).toBe(false);
    expect(isInheritableByTeamMember(GrantType.PROJECT_WRITE)).toBe(true);
    expect(isInheritableByTeamMember(GrantType.PROJECT_READ)).toBe(true);
  });
});
