import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL_MS } from './common/throttle.config';
import { PrismaModule } from './prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { TeamsModule } from './modules/teams/teams.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { TeamInvitesModule } from './modules/team-invites/team-invites.module';
import { GrantsModule } from './modules/grants/grants.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { TokensModule } from './modules/tokens/tokens.module';


@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT }]),
    PrismaModule,
    CommonModule,
    HealthModule,
    UsersModule,
    TeamsModule,
    MembershipsModule,
    TeamInvitesModule,
    GrantsModule,
    AuthModule,
    SessionsModule,
    TokensModule,
  ],
})
export class AppModule {}
