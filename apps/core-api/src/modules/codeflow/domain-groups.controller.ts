import {
  Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { RequireGrant } from '../../common/require-grant.decorator';
import { DomainGroupsService } from './domain-groups.service';
import { CreateDomainGroupDto } from './dto/create-domain-group.dto';
import { UpdateDomainGroupDto } from './dto/update-domain-group.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('projects/:projectId/domain-groups')
export class DomainGroupsController {

  constructor(@Inject(DomainGroupsService) private readonly svc: DomainGroupsService) {}


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDomainGroupDto,
  ) {

    return this.svc.create(projectId, dto);
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get()
  list(@Param('projectId') projectId: string) {

    return this.svc.list(projectId);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Patch(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDomainGroupDto,
  ) {

    return this.svc.update(projectId, id, dto);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Delete(':id')
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {

    return this.svc.remove(projectId, id);
  }
}
