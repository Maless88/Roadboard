import { GrantType } from '@roadboard/domain';

const ADMIN_GRANTS: readonly GrantType[] = [
  GrantType.PROJECT_READ,
  GrantType.PROJECT_WRITE,
  GrantType.TASK_WRITE,
  GrantType.MEMORY_WRITE,
  GrantType.DECISION_WRITE,
  GrantType.DASHBOARD_READ,
  GrantType.TOKEN_MANAGE,
  GrantType.PROJECT_ADMIN,
  GrantType.CODEFLOW_READ,
  GrantType.CODEFLOW_WRITE,
  GrantType.CODEFLOW_SCAN,
];

// Grants a plain team member is allowed to inherit from a team-scoped grant.
// Privileged grants (PROJECT_ADMIN, TOKEN_MANAGE, CODEFLOW_SCAN) require team_role='admin'.
const TEAM_MEMBER_INHERITABLE_GRANTS: readonly GrantType[] = [
  GrantType.PROJECT_READ,
  GrantType.PROJECT_WRITE,
  GrantType.TASK_WRITE,
  GrantType.MEMORY_WRITE,
  GrantType.DECISION_WRITE,
  GrantType.DASHBOARD_READ,
  GrantType.CODEFLOW_READ,
  GrantType.CODEFLOW_WRITE,
];

const TEAM_MEMBER_INHERITABLE_SET: ReadonlySet<GrantType> = new Set(TEAM_MEMBER_INHERITABLE_GRANTS);

export type TeamRole = 'admin' | 'member';

export interface EffectiveGrant {
  projectId: string;
  grantType: GrantType;
}

export function isAdminGrant(grantType: GrantType): boolean {
  return grantType === GrantType.PROJECT_ADMIN;
}

export function expandAdminGrant(): readonly GrantType[] {
  return ADMIN_GRANTS;
}

export function isInheritableByTeamMember(grantType: GrantType): boolean {
  return TEAM_MEMBER_INHERITABLE_SET.has(grantType);
}


// Given a list of grants inherited from a team, apply the team_role gating:
// - admin: everything passes through.
// - member: PROJECT_ADMIN is downgraded to the full operational set; privileged
//   grants outside the inheritable whitelist (TOKEN_MANAGE, CODEFLOW_SCAN) are dropped.
export function filterGrantsByTeamRole(
  grants: EffectiveGrant[],
  teamRole: TeamRole,
): EffectiveGrant[] {
  if (teamRole === 'admin') return grants;

  const result: EffectiveGrant[] = [];

  for (const g of grants) {

    if (g.grantType === GrantType.PROJECT_ADMIN) {

      for (const op of TEAM_MEMBER_INHERITABLE_GRANTS) {
        result.push({ projectId: g.projectId, grantType: op });
      }
      continue;
    }

    if (TEAM_MEMBER_INHERITABLE_SET.has(g.grantType)) {
      result.push(g);
    }
  }

  return result;
}

export function hasPermission(
  grants: EffectiveGrant[],
  projectId: string,
  requiredGrant: GrantType,
): boolean {
  return grants.some(
    (g) =>
      g.projectId === projectId &&
      (g.grantType === requiredGrant || g.grantType === GrantType.PROJECT_ADMIN),
  );
}
