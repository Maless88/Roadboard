import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/user.decorator';
import { CreateTeamInviteDto } from './create-team-invite.dto';
import { TeamInvitesService } from './team-invites.service';


type AuthUser = { userId: string };


@Controller()
export class TeamInvitesController {

  constructor(
    @Inject(TeamInvitesService) private readonly invites: TeamInvitesService,
  ) {}


  @Post('teams/:teamId/invites')
  @UseGuards(AuthGuard)
  create(
    @Param('teamId') teamId: string,
    @Body() dto: CreateTeamInviteDto,
    @CurrentUser() user: AuthUser,
  ) {

    return this.invites.create(teamId, user.userId, dto);
  }


  @Get('teams/:teamId/invites')
  @UseGuards(AuthGuard)
  list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthUser,
  ) {

    return this.invites.list(teamId, user.userId);
  }


  @Delete('invites/:id')
  @UseGuards(AuthGuard)
  revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {

    return this.invites.revoke(id, user.userId);
  }


  @Get('invites/by-token/:token')
  findByToken(@Param('token') token: string) {

    return this.invites.findByToken(token);
  }


  @Post('invites/by-token/:token/accept')
  @UseGuards(AuthGuard)
  accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthUser,
  ) {

    return this.invites.accept(token, user.userId);
  }
}
