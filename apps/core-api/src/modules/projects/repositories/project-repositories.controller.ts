import {
  Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../../common/auth.guard';
import { GrantCheckGuard } from '../../../common/grant-check.guard';
import { RequireGrant } from '../../../common/require-grant.decorator';
import { ProjectRepositoriesService } from './project-repositories.service';
import { CreateProjectRepositoryDto } from './create-project-repository.dto';
import { UpdateProjectRepositoryDto } from './update-project-repository.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('projects/:projectId/repositories')
export class ProjectRepositoriesController {

  constructor(
    @Inject(ProjectRepositoriesService)
    private readonly reposService: ProjectRepositoriesService,
  ) {}


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  list(@Param('projectId') projectId: string) {

    return this.reposService.list(projectId);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectRepositoryDto,
  ) {

    return this.reposService.create(projectId, dto);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Patch(':repoId')
  update(
    @Param('projectId') projectId: string,
    @Param('repoId') repoId: string,
    @Body() dto: UpdateProjectRepositoryDto,
  ) {

    return this.reposService.update(repoId, projectId, dto);
  }


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Delete(':repoId')
  remove(
    @Param('projectId') projectId: string,
    @Param('repoId') repoId: string,
  ) {

    return this.reposService.remove(repoId, projectId);
  }
}
