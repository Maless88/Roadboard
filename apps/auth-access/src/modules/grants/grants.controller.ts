import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Inject,
} from '@nestjs/common';
import { FindGrantsQueryDto } from '../../common/query.dto';
import { CheckPermissionDto } from './check-permission.dto';
import { GrantsService } from './grants.service';
import { CreateGrantDto } from './create-grant.dto';


@Controller('grants')
export class GrantsController {

  constructor(@Inject(GrantsService) private readonly grantsService: GrantsService) {}


  @Post()
  create(@Body() dto: CreateGrantDto) {

    return this.grantsService.create(dto);
  }


  @Get()
  findByProject(@Query() query: FindGrantsQueryDto) {

    return this.grantsService.findByProject(query.projectId);
  }


  @Get('check')
  checkPermission(@Query() dto: CheckPermissionDto) {

    return this.grantsService.checkPermission(dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.grantsService.delete(id);
  }
}
