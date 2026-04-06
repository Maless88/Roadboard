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
import { TokensService } from './tokens.service';
import { CreateTokenDto } from './create-token.dto';
import { ValidateTokenDto } from './validate-token.dto';


@Controller('tokens')
export class TokensController {

  constructor(@Inject(TokensService) private readonly tokensService: TokensService) {}


  @Post()
  create(@Body() dto: CreateTokenDto) {

    return this.tokensService.create(dto);
  }


  @Get()
  findByUser(@Query('userId') userId: string) {

    return this.tokensService.findByUser(userId);
  }


  @Post('validate')
  validate(@Body() dto: ValidateTokenDto) {

    return this.tokensService.validate(dto.token);
  }


  @Delete(':id')
  revoke(@Param('id') id: string) {

    return this.tokensService.revoke(id);
  }
}
