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
import { FindMemoryQueryDto } from '../../common/query.dto';
import { RequireGrant } from '../../common/require-grant.decorator';
import { MemoryService } from './memory.service';
import { CreateMemoryEntryDto } from './create-memory-entry.dto';
import { UpdateMemoryEntryDto } from './update-memory-entry.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('memory')
export class MemoryController {

  constructor(@Inject(MemoryService) private readonly memoryService: MemoryService) {}


  @RequireGrant(GrantType.MEMORY_WRITE)
  @Post()
  create(@Body() dto: CreateMemoryEntryDto) {

    return this.memoryService.create(dto);
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get()
  findAll(@Query() query: FindMemoryQueryDto) {

    return this.memoryService.findAll({
      projectId: query.projectId,
      type: query.type,
      q: query.q,
    });
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.memoryService.findOne(id);
  }


  @RequireGrant(GrantType.MEMORY_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemoryEntryDto) {

    return this.memoryService.update(id, dto);
  }


  @RequireGrant(GrantType.MEMORY_WRITE)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.memoryService.delete(id);
  }
}
