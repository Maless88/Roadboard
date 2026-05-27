/**
 * Effective-grant computation for the Contributors tab.
 *
 * Mirrors the logic of `filterGrantsByTeamRole` from @roadboard/grants
 * without introducing a runtime dependency on the package from the
 * web-app bundle. The GrantType string values are stable domain constants.
 */

// ─── grant type string constants (mirrors GrantType enum in @roadboard/domain) ─

const GT_PROJECT_ADMIN = 'project.admin';
const GT_TOKEN_MANAGE = 'token.manage';
const GT_CODEFLOW_SCAN = 'codeflow.scan';

/** Grants a plain team member inherits (mirrors TEAM_MEMBER_INHERITABLE_GRANTS). */
const TEAM_MEMBER_INHERITABLE: readonly string[] = [
  'project.read',
  'project.write',
  'task.write',
  'memory.write',
  'decision.write',
  'dashboard.read',
  'codeflow.read',
  'codeflow.write',
];

const TEAM_MEMBER_INHERITABLE_SET = new Set(TEAM_MEMBER_INHERITABLE);

// ─── public types ────────────────────────────────────────────────────────────

export type GrantOrigin = 'direct' | 'team-inherited' | 'admin-expanded' | 'downgraded';

export interface EffectiveContributorGrant {
  grantType: string;
  origin: GrantOrigin;
}

export interface EffectiveContributor {
  userId: string;
  effectiveGrants: EffectiveContributorGrant[];
  /** True when the user is a member of the ownerTeam but has zero effective grants. */
  noAccess: boolean;
}

// ─── input types ─────────────────────────────────────────────────────────────

export interface RawGrant {
  subjectType: string;
  subjectId: string;
  grantType: string;
}

export interface TeamMember {
  userId: string;
  /** 'admin' | 'member' */
  role: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────


/**
 * Given a list of grants scoped to a team and a team_role, apply the same
 * gating as `filterGrantsByTeamRole` from @roadboard/grants:
 *
 * - admin  → all grants pass through unchanged (origin = 'team-inherited')
 * - member → PROJECT_ADMIN is downgraded to the inheritable set (origin = 'downgraded');
 *            privileged grants outside the inheritable whitelist are dropped;
 *            remaining inheritable grants pass as 'team-inherited'.
 */
function applyTeamRoleFilter(
  teamGrants: string[],
  teamRole: string,
  projectId: string,
): EffectiveContributorGrant[] {

  if (teamRole === 'admin') {
    return teamGrants.map((grantType) => ({ grantType, origin: 'team-inherited' as GrantOrigin }));
  }

  const result: EffectiveContributorGrant[] = [];

  for (const grantType of teamGrants) {

    if (grantType === GT_PROJECT_ADMIN) {
      for (const op of TEAM_MEMBER_INHERITABLE) {
        result.push({ grantType: op, origin: 'downgraded' });
      }
      continue;
    }

    if (TEAM_MEMBER_INHERITABLE_SET.has(grantType)) {
      result.push({ grantType, origin: 'team-inherited' });
    }
  }

  // suppress unused projectId — kept in signature for future extensibility
  void projectId;

  return result;
}


/**
 * Computes the effective contributors for a project, merging direct user grants
 * with team-inherited grants for every ownerTeam member.
 *
 * Rules:
 * - Every user with a direct user-level grant is included.
 * - Every ownerTeam member is included; their team grants are filtered through
 *   the team-role gating (same semantics as `filterGrantsByTeamRole`).
 * - Direct grants always win over inherited ones for deduplication (direct
 *   entry is kept; duplicate grantType from team inheritance is dropped).
 * - ownerTeam members with zero effective grants are flagged as `noAccess`.
 */
export function computeEffectiveContributors(params: {
  projectId: string;
  grants: RawGrant[];
  teamMembers: TeamMember[];
  /** Grant types that are scoped to the team as a subject (subjectType === 'team'). */
  teamGrantTypes: string[];
}): EffectiveContributor[] {

  const { projectId, grants, teamMembers, teamGrantTypes } = params;

  // --- index direct user grants by userId
  const directByUser = new Map<string, string[]>();

  for (const g of grants) {

    if (g.subjectType !== 'user') continue;

    const list = directByUser.get(g.subjectId) ?? [];
    list.push(g.grantType);
    directByUser.set(g.subjectId, list);
  }

  // --- collect all user ids we need to represent
  const allUserIds = new Set<string>([
    ...directByUser.keys(),
    ...teamMembers.map((m) => m.userId),
  ]);

  const result: EffectiveContributor[] = [];

  for (const userId of allUserIds) {

    const direct = directByUser.get(userId) ?? [];
    const directSet = new Set(direct);

    const directGrants: EffectiveContributorGrant[] = direct.map((grantType) => ({
      grantType,
      origin: grantType === GT_PROJECT_ADMIN ? 'admin-expanded' : ('direct' as GrantOrigin),
    }));

    // compute inherited grants from team membership
    const membership = teamMembers.find((m) => m.userId === userId);
    const inheritedGrants: EffectiveContributorGrant[] = [];

    if (membership) {
      const filtered = applyTeamRoleFilter(teamGrantTypes, membership.role, projectId);

      for (const eg of filtered) {

        if (!directSet.has(eg.grantType)) {
          inheritedGrants.push(eg);
        }
      }
    }

    const effectiveGrants = [...directGrants, ...inheritedGrants];

    result.push({
      userId,
      effectiveGrants,
      noAccess: effectiveGrants.length === 0,
    });
  }

  return result;
}
