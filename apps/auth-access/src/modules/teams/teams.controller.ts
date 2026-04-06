import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Inject,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './create-team.dto';
import { UpdateTeamDto } from './update-team.dto';


@Controller('teams')
export class TeamsController {

  constructor(@Inject(TeamsService) private readonly teamsService: TeamsService) {}


  @Post()
  create(@Body() dto: CreateTeamDto) {

    return this.teamsService.create(dto);
  }


  @Get()
  findAll() {

    return this.teamsService.findAll();
  }


  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.teamsService.findOne(id);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {

    return this.teamsService.update(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.teamsService.delete(id);
  }
}
