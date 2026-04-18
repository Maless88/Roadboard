import {
  Controller,
  Post,
  Body,
  Headers,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';


@Controller('auth')
export class AuthController {

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}


  @Post('login')
  login(@Body() dto: LoginDto) {

    return this.authService.login(dto);
  }


  @Post('register')
  register(@Body() dto: RegisterDto) {

    return this.authService.register(dto);
  }


  @Post('logout')
  logout(@Headers('authorization') authHeader: string) {

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    return this.authService.logout(token);
  }
}
