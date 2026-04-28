import { Module } from '@nestjs/common';
import { TeamInvitesController } from './team-invites.controller';
import { TeamInvitesService } from './team-invites.service';


@Module({
  controllers: [TeamInvitesController],
  providers: [TeamInvitesService],
  exports: [TeamInvitesService],
})
export class TeamInvitesModule {}
