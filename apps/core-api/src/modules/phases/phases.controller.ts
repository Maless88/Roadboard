import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/user.decorator';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { FindPhasesQueryDto } from '../../common/query.dto';
import { RequireGrant } from '../../common/require-grant.decorator';
import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './create-phase.dto';
import { UpdatePhaseDto } from './update-phase.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('phases')
export class PhasesController {

  constructor(@Inject(PhasesService) private readonly phasesService: PhasesService) {}


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Post()
  create(@Body() dto: CreatePhaseDto, @CurrentUser() user: AuthUser) {

    return this.phasesService.create(dto, user);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(@Query() query: FindPhasesQueryDto) {

    return this.phasesService.findAll(query.projectId, query.decisionId);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.phasesService.findOne(id);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePhaseDto, @CurrentUser() user: AuthUser) {

    return this.phasesService.update(id, dto, user);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {

    return this.phasesService.delete(id, user);
  }
}
