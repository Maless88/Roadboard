import { Controller, Get, Post, Body, Query } from '@nestjs/common';

import { MemoryService, CreateMemoryDto } from './memory.service';


@Controller('memory')
export class MemoryController {

  constructor(private readonly memory: MemoryService) {}


  @Get()
  async list(
    @Query('projectId') projectId: string,
    @Query('type') type?: string,
  ): Promise<unknown[]> {

    return this.memory.listMemory(projectId, type);
  }


  @Post()
  async create(@Body() dto: CreateMemoryDto): Promise<unknown> {

    return this.memory.createMemory(dto);
  }
}
