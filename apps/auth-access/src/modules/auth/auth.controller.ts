import {
  Controller,
  Post,
  Body,
  Headers,
  Inject,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { AuthThrottlerGuard } from '../../common/throttler.guard';


@UseGuards(AuthThrottlerGuard)
@Controller('auth')
export class AuthController {

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}


  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {

    return this.authService.login(dto);
  }


  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {

    return this.authService.register(dto);
  }


  @SkipThrottle()
  @Post('logout')
  logout(@Headers('authorization') authHeader: string) {

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    return this.authService.logout(token);
  }
}
