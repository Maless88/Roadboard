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
import { ProjectStatus } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './create-project.dto';
import { UpdateProjectDto } from './update-project.dto';


@UseGuards(AuthGuard)
@Controller('projects')
export class ProjectsController {

  constructor(@Inject(ProjectsService) private readonly projectsService: ProjectsService) {}


  @Post()
  create(@Body() dto: CreateProjectDto) {

    return this.projectsService.create(dto);
  }


  @Get()
  findAll(@Query('status') status?: ProjectStatus) {

    return this.projectsService.findAll(status);
  }


  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.projectsService.findOne(id);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {

    return this.projectsService.update(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.projectsService.delete(id);
  }
}
