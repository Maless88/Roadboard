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
  create(@Body() dto: CreateTaskDto) {

    return this.tasksService.create(dto);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(@Query() query: FindTasksQueryDto) {

    return this.tasksService.findAll({
      projectId: query.projectId,
      phaseId: query.phaseId,
      milestoneId: query.milestoneId,
      status: query.status,
    });
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.tasksService.findOne(id);
  }


  @RequireGrant(GrantType.TASK_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {

    return this.tasksService.update(id, dto);
  }


  @RequireGrant(GrantType.TASK_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.tasksService.delete(id);
  }
}
