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
import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './create-phase.dto';
import { UpdatePhaseDto } from './update-phase.dto';


@UseGuards(AuthGuard)
@Controller('phases')
export class PhasesController {

  constructor(@Inject(PhasesService) private readonly phasesService: PhasesService) {}


  @Post()
  create(@Body() dto: CreatePhaseDto) {

    return this.phasesService.create(dto);
  }


  @Get()
  findAll(@Query('projectId') projectId: string) {

    return this.phasesService.findAll(projectId);
  }


  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.phasesService.findOne(id);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePhaseDto) {

    return this.phasesService.update(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.phasesService.delete(id);
  }
}
