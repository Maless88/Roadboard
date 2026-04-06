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
import { AuthGuard } from '../../common/auth.guard';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './create-milestone.dto';
import { UpdateMilestoneDto } from './update-milestone.dto';


@UseGuards(AuthGuard)
@Controller('milestones')
export class MilestonesController {

  constructor(@Inject(MilestonesService) private readonly milestonesService: MilestonesService) {}


  @Post()
  create(@Body() dto: CreateMilestoneDto) {

    return this.milestonesService.create(dto);
  }


  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Query('phaseId') phaseId?: string,
  ) {

    return this.milestonesService.findAll({ projectId, phaseId });
  }


  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.milestonesService.findOne(id);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMilestoneDto) {

    return this.milestonesService.update(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.milestonesService.delete(id);
  }
}
