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
import { GrantCheckGuard } from '../../common/grant-check.guard';
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
  create(@Body() dto: CreatePhaseDto) {

    return this.phasesService.create(dto);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(@Query('projectId') projectId: string) {

    return this.phasesService.findAll(projectId);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.phasesService.findOne(id);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePhaseDto) {

    return this.phasesService.update(id, dto);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.phasesService.delete(id);
  }
}
