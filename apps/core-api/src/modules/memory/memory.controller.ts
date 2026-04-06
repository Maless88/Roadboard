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
import { MemoryEntryType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { MemoryService } from './memory.service';
import { CreateMemoryEntryDto } from './create-memory-entry.dto';
import { UpdateMemoryEntryDto } from './update-memory-entry.dto';


@UseGuards(AuthGuard)
@Controller('memory')
export class MemoryController {

  constructor(@Inject(MemoryService) private readonly memoryService: MemoryService) {}


  @Post()
  create(@Body() dto: CreateMemoryEntryDto) {

    return this.memoryService.create(dto);
  }


  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Query('type') type?: MemoryEntryType,
  ) {

    return this.memoryService.findAll({ projectId, type });
  }


  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.memoryService.findOne(id);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemoryEntryDto) {

    return this.memoryService.update(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.memoryService.delete(id);
  }
}
