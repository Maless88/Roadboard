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
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/user.decorator';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { FindTasksQueryDto } from '../../common/query.dto';
import { RequireGrant } from '../../common/require-grant.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('tasks')
export class TasksController {

  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}


  @RequireGrant(GrantType.TASK_WRITE)
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {

    return this.tasksService.create(dto, user);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(@Query() query: FindTasksQueryDto) {

    return this.tasksService.findAll({
      projectId: query.projectId,
      phaseId: query.phaseId,
      status: query.status,
      take: query.take,
    });
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get('count')
  async getCount(@Query() query: FindTasksQueryDto): Promise<{ count: number }> {

    const count = await this.tasksService.count({
      projectId: query.projectId,
      phaseId: query.phaseId,
      status: query.status,
    });
    return { count };
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.tasksService.findOne(id);
  }


  @RequireGrant(GrantType.TASK_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {

    return this.tasksService.update(id, dto, user);
  }


  @RequireGrant(GrantType.TASK_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {

    return this.tasksService.delete(id, user);
  }
}
