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
import { TaskStatus } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';


@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {

  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}


  @Post()
  create(@Body() dto: CreateTaskDto) {

    return this.tasksService.create(dto);
  }


  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Query('phaseId') phaseId?: string,
    @Query('milestoneId') milestoneId?: string,
    @Query('status') status?: TaskStatus,
  ) {

    return this.tasksService.findAll({ projectId, phaseId, milestoneId, status });
  }


  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.tasksService.findOne(id);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {

    return this.tasksService.update(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.tasksService.delete(id);
  }
}
