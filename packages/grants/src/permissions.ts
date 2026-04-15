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
