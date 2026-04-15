import {
  Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { RequireGrant } from '../../common/require-grant.decorator';
import { CodeflowService } from './codeflow.service';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('projects/:projectId/codeflow/repositories')
export class RepositoriesController {

  constructor(@Inject(CodeflowService) private readonly codeflowService: CodeflowService) {}


  @RequireGrant(GrantType.PROJECT_ADMIN)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRepositoryDto,
  ) {

    return this.codeflowService.createRepository({ ...dto, projectId });
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get()
  list(@Param('projectId') projectId: string) {

    return this.codeflowService.listRepositories(projectId);
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get(':id')
  getOne(@Param('id') id: string) {

    return this.codeflowService.getRepository(id);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRepositoryDto) {

    return this.codeflowService.updateRepository(id, dto);
  }


  @RequireGrant(GrantType.PROJECT_ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.codeflowService.deleteRepository(id);
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get(':id/scans')
  listScans(@Param('id') id: string) {

    return this.codeflowService.listSnapshots(id);
  }
}
