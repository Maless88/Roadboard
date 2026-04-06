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
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './create-milestone.dto';
import { UpdateMilestoneDto } from './update-milestone.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('milestones')
export class MilestonesController {

  constructor(@Inject(MilestonesService) private readonly milestonesService: MilestonesService) {}


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Post()
  create(@Body() dto: CreateMilestoneDto) {

    return this.milestonesService.create(dto);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Query('phaseId') phaseId?: string,
  ) {

    return this.milestonesService.findAll({ projectId, phaseId });
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.milestonesService.findOne(id);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMilestoneDto) {

    return this.milestonesService.update(id, dto);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.milestonesService.delete(id);
  }
}
