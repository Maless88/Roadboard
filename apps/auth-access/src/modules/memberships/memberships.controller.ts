import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Inject,
} from '@nestjs/common';
import { FindMembershipsQueryDto } from '../../common/query.dto';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './create-membership.dto';
import { UpdateMembershipDto } from './update-membership.dto';


@Controller('memberships')
export class MembershipsController {

  constructor(@Inject(MembershipsService) private readonly membershipsService: MembershipsService) {}


  @Post()
  create(@Body() dto: CreateMembershipDto) {

    return this.membershipsService.create(dto);
  }


  @Get()
  find(@Query() query: FindMembershipsQueryDto) {

    if (query.teamId) return this.membershipsService.findByTeam(query.teamId);

    if (query.userId) return this.membershipsService.findByUser(query.userId);

    throw new Error('Either teamId or userId is required');
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMembershipDto) {

    return this.membershipsService.update(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.membershipsService.delete(id);
  }
}
