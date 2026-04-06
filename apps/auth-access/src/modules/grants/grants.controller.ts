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
  findByProject(@Query('projectId') projectId: string) {

    return this.grantsService.findByProject(projectId);
  }


  @Get('check')
  checkPermission(
    @Query('projectId') projectId: string,
    @Query('subjectType') subjectType: string,
    @Query('subjectId') subjectId: string,
    @Query('grantType') grantType: string,
  ) {

    return this.grantsService.checkPermission({
      projectId,
      subjectType,
      subjectId,
      grantType,
    });
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.grantsService.delete(id);
  }
}
