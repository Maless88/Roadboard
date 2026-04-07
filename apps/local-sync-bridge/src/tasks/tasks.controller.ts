import { Controller, Post, Patch, Param, Body } from '@nestjs/common';

import { TasksService, CreateTaskDto, UpdateTaskStatusDto } from './tasks.service';


@Controller('tasks')
export class TasksController {

  constructor(private readonly tasks: TasksService) {}


  @Post()
  async create(@Body() dto: CreateTaskDto): Promise<unknown> {

    return this.tasks.createTask(dto);
  }


  @Patch(':taskId/status')
  async updateStatus(
    @Param('taskId') taskId: string,
    @Body() body: { status: string },
  ): Promise<unknown> {

    return this.tasks.updateTaskStatus({ taskId, status: body.status });
  }
}
