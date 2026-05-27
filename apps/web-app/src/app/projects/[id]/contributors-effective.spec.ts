import { describe, it, expect } from 'vitest';
import { computeEffectiveContributors } from './contributors-effective';


const PROJECT_ID = 'proj-1';
const TEAM_ID = 'team-1';

const USER_DIRECT = 'user-direct';
const USER_TEAM_ADMIN = 'user-team-admin';
const USER_TEAM_MEMBER_DOWNGRADED = 'user-team-member-downgraded';
const USER_TEAM_MEMBER_NO_ACCESS = 'user-team-member-no-access';


describe('computeEffectiveContributors', () => {


  it('user with direct grant has origin=direct', () => {

    const result = computeEffectiveContributors({
      projectId: PROJECT_ID,
      grants: [
        { subjectType: 'user', subjectId: USER_DIRECT, grantType: 'project.write' },
        { subjectType: 'user', subjectId: USER_DIRECT, grantType: 'task.write' },
      ],
      teamMembers: [],
      teamGrantTypes: [],
    });

    const contributor = result.find((c) => c.userId === USER_DIRECT);
    expect(contributor).toBeDefined();
    expect(contributor!.noAccess).toBe(false);
    expect(contributor!.effectiveGrants.every((g) => g.origin === 'direct')).toBe(true);
    expect(contributor!.effectiveGrants.map((g) => g.grantType)).toContain('project.write');
    expect(contributor!.effectiveGrants.map((g) => g.grantType)).toContain('task.write');
  });


  it('team admin inherits all team grants with origin=team-inherited', () => {

    const teamGrantTypes = ['project.admin', 'project.write'];

    const result = computeEffectiveContributors({
      projectId: PROJECT_ID,
      grants: [
        { subjectType: 'team', subjectId: TEAM_ID, grantType: 'project.admin' },
        { subjectType: 'team', subjectId: TEAM_ID, grantType: 'project.write' },
      ],
      teamMembers: [{ userId: USER_TEAM_ADMIN, role: 'admin' }],
      teamGrantTypes,
    });

    const contributor = result.find((c) => c.userId === USER_TEAM_ADMIN);
    expect(contributor).toBeDefined();
    expect(contributor!.noAccess).toBe(false);
    expect(contributor!.effectiveGrants.every((g) => g.origin === 'team-inherited')).toBe(true);
    expect(contributor!.effectiveGrants.map((g) => g.grantType)).toContain('project.admin');
    expect(contributor!.effectiveGrants.map((g) => g.grantType)).toContain('project.write');
  });


  it('team member with PROJECT_ADMIN in team grants gets downgraded inheritable set', () => {

    const teamGrantTypes = ['project.admin', 'token.manage', 'codeflow.scan'];

    const result = computeEffectiveContributors({
      projectId: PROJECT_ID,
      grants: [
        { subjectType: 'team', subjectId: TEAM_ID, grantType: 'project.admin' },
        { subjectType: 'team', subjectId: TEAM_ID, grantType: 'token.manage' },
        { subjectType: 'team', subjectId: TEAM_ID, grantType: 'codeflow.scan' },
      ],
      teamMembers: [{ userId: USER_TEAM_MEMBER_DOWNGRADED, role: 'member' }],
      teamGrantTypes,
    });

    const contributor = result.find((c) => c.userId === USER_TEAM_MEMBER_DOWNGRADED);
    expect(contributor).toBeDefined();
    expect(contributor!.noAccess).toBe(false);

    const grantTypes = contributor!.effectiveGrants.map((g) => g.grantType);

    // project.admin downgraded → inheritable set
    expect(grantTypes).toContain('project.read');
    expect(grantTypes).toContain('project.write');
    expect(grantTypes).toContain('task.write');
    expect(grantTypes).toContain('memory.write');
    expect(grantTypes).toContain('decision.write');
    expect(grantTypes).toContain('dashboard.read');
    expect(grantTypes).toContain('codeflow.read');
    expect(grantTypes).toContain('codeflow.write');

    // privileged grants must be dropped
    expect(grantTypes).not.toContain('project.admin');
    expect(grantTypes).not.toContain('token.manage');
    expect(grantTypes).not.toContain('codeflow.scan');

    // origin must be 'downgraded' for all entries
    expect(contributor!.effectiveGrants.every((g) => g.origin === 'downgraded')).toBe(true);
  });


  it('team member without any effective grant is flagged noAccess', () => {

    // Team has no grants scoped to this project for the team subject
    const result = computeEffectiveContributors({
      projectId: PROJECT_ID,
      grants: [],
      teamMembers: [{ userId: USER_TEAM_MEMBER_NO_ACCESS, role: 'member' }],
      teamGrantTypes: [],
    });

    const contributor = result.find((c) => c.userId === USER_TEAM_MEMBER_NO_ACCESS);
    expect(contributor).toBeDefined();
    expect(contributor!.noAccess).toBe(true);
    expect(contributor!.effectiveGrants).toHaveLength(0);
  });
});
