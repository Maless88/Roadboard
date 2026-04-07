import { Controller, Post, Body } from '@nestjs/common';

import { MemoryService, CreateMemoryDto } from './memory.service';


@Controller('memory')
export class MemoryController {

  constructor(private readonly memory: MemoryService) {}


  @Post()
  async create(@Body() dto: CreateMemoryDto): Promise<unknown> {

    return this.memory.createMemory(dto);
  }
}
