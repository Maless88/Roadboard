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
import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL_MS } from '../../common/throttle.config';


@UseGuards(AuthThrottlerGuard)
@Controller('auth')
export class AuthController {

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}


  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
  @Post('login')
  login(@Body() dto: LoginDto) {

    return this.authService.login(dto);
  }


  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
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
