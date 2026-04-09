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
import { FindByUserQueryDto } from '../../common/query.dto';
import { SessionsService } from './sessions.service';
import { ValidateSessionDto } from './validate-session.dto';


@Controller('sessions')
export class SessionsController {

  constructor(@Inject(SessionsService) private readonly sessionsService: SessionsService) {}


  @Post('validate')
  validate(@Body() dto: ValidateSessionDto) {

    return this.sessionsService.validate(dto.token);
  }


  @Get()
  findByUser(@Query() query: FindByUserQueryDto) {

    return this.sessionsService.findByUser(query.userId);
  }


  @Delete(':id')
  revoke(@Param('id') id: string) {

    return this.sessionsService.revoke(id);
  }
}
