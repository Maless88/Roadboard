import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { TeamsModule } from './modules/teams/teams.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { GrantsModule } from './modules/grants/grants.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { TokensModule } from './modules/tokens/tokens.module';


@Module({
  imports: [
    PrismaModule,
    CommonModule,
    HealthModule,
    UsersModule,
    TeamsModule,
    MembershipsModule,
    GrantsModule,
    AuthModule,
    SessionsModule,
    TokensModule,
  ],
})
export class AppModule {}
