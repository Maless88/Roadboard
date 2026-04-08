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
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto } from './create-decision.dto';
import { UpdateDecisionDto } from './update-decision.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('decisions')
export class DecisionsController {

  constructor(@Inject(DecisionsService) private readonly decisionsService: DecisionsService) {}


  @RequireGrant(GrantType.DECISION_WRITE)
  @Post()
  create(@Body() dto: CreateDecisionDto) {

    return this.decisionsService.create(dto);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Query('status') status?: string,
  ) {

    return this.decisionsService.findAll(projectId, status);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.decisionsService.findOne(id);
  }


  @RequireGrant(GrantType.DECISION_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDecisionDto) {

    return this.decisionsService.update(id, dto);
  }


  @RequireGrant(GrantType.DECISION_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.decisionsService.delete(id);
  }
}
