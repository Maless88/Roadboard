import { SetMetadata } from '@nestjs/common';
import { GrantType } from '@roadboard/domain';


export const REQUIRED_GRANT_KEY = 'requiredGrant';


export const RequireGrant = (grantType: GrantType) =>
  SetMetadata(REQUIRED_GRANT_KEY, grantType);
