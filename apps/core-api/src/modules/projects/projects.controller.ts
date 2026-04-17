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
import { FindProjectsQueryDto } from '../../common/query.dto';
import { RequireGrant } from '../../common/require-grant.decorator';
import { CurrentUser } from '../../common/user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './create-project.dto';
import { UpdateProjectDto } from './update-project.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('projects')
export class ProjectsController {

  constructor(@Inject(ProjectsService) private readonly projectsService: ProjectsService) {}


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: { userId: string }) {

    return this.projectsService.create(dto, user?.userId);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(@Query() query: FindProjectsQueryDto) {

    return this.projectsService.findAll(query.status);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.projectsService.findOne(id);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {

    return this.projectsService.update(id, dto);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.projectsService.delete(id);
  }
}
